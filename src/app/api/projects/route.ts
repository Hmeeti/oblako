import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { createProject, listProjectsForUser } from "@/server/repositories/projects";
import { slugify } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true },
  });
  const projects = await listProjectsForUser(
    user.id,
    user.platformRole === "studio_admin",
  );
  return NextResponse.json({
    projects,
    memberships,
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(2).max(48).optional(),
  themeId: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  assertCan(user && { ...user, memberships: [] }, "project:create");
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  let slug = parsed.data.slug || slugify(parsed.data.name);
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "bad_slug" }, { status: 400 });
  }
  let n = 1;
  const base = slug;
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }
  const project = await createProject({
    name: parsed.data.name,
    slug,
    ownerId: user!.id,
    themeId: parsed.data.themeId,
  });
  await prisma.qrCode.create({
    data: {
      code: nanoid(8),
      projectId: project.id,
      label: "Общий QR",
    },
  });
  return NextResponse.json({ project });
}
