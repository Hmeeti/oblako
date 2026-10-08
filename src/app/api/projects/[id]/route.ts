import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { getProjectById, updateProject } from "@/server/repositories/projects";

async function loadAuth() {
  const user = await getSessionUser();
  if (!user) return { user: null, memberships: [] as Array<{ projectId: string; role: "project_owner" | "project_editor" }> };
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true },
  });
  return { user: { ...user, memberships }, memberships };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { user } = await loadAuth();
  assertCan(user, "project:read", { projectId: id });
  const project = await getProjectById(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ project });
}

const patchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  status: z.enum(["draft", "live", "paused"]).optional(),
  themeId: z.string().optional(),
  serviceChargePercent: z.number().int().min(0).max(40).optional(),
  features: z.record(z.string(), z.unknown()).optional(),
  contacts: z.record(z.string(), z.unknown()).optional(),
  logo: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { user } = await loadAuth();
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const needsSettings =
    parsed.data.status !== undefined ||
    parsed.data.themeId !== undefined ||
    parsed.data.features !== undefined ||
    parsed.data.contacts !== undefined;
  assertCan(user, needsSettings ? "project:settings" : "project:write", {
    projectId: id,
  });
  const data: Prisma.ProjectUpdateInput = {
    name: parsed.data.name,
    status: parsed.data.status,
    themeId: parsed.data.themeId,
    serviceChargePercent: parsed.data.serviceChargePercent,
    logo: parsed.data.logo,
    features: parsed.data.features as Prisma.InputJsonValue | undefined,
    contacts: parsed.data.contacts as Prisma.InputJsonValue | undefined,
  };
  const project = await updateProject(id, data);
  await prisma.auditLog.create({
    data: {
      projectId: id,
      userId: user!.id,
      action: "project.update",
      meta: parsed.data as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({ project });
}
