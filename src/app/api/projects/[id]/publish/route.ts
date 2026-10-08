import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { publishMenu, rollbackMenu } from "@/server/repositories/menu";
import { getProjectById, updateProject } from "@/server/repositories/projects";

async function auth() {
  const user = await getSessionUser();
  if (!user) return null;
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true },
  });
  return { ...user, memberships };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await auth();
  assertCan(user, "menu:publish", { projectId: id });
  const body = await req.json().catch(() => ({}));
  if (body?.rollbackVersionId) {
    const version = await rollbackMenu(id, body.rollbackVersionId);
    if (!version) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await prisma.auditLog.create({
      data: {
        projectId: id,
        userId: user!.id,
        action: "menu.rollback",
        meta: { versionId: body.rollbackVersionId },
      },
    });
    const project = await getProjectById(id);
    if (project) revalidatePath(`/m/${project.slug}`);
    return NextResponse.json({ ok: true, rolledBack: version.id });
  }

  const version = await publishMenu(id, user!.id, body?.note);
  await updateProject(id, { status: "live" });
  await prisma.auditLog.create({
    data: {
      projectId: id,
      userId: user!.id,
      action: "menu.publish",
      meta: { versionId: version.id },
    },
  });
  const project = await getProjectById(id);
  if (project) revalidatePath(`/m/${project.slug}`);
  return NextResponse.json({ ok: true, versionId: version.id });
}
