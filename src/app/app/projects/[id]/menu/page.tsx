import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { getDraftMenu } from "@/server/repositories/menu";
import { MenuEditor } from "@/components/app/MenuEditor";

export default async function MenuEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user!.id },
    select: { projectId: true, role: true },
  });
  assertCan({ ...user!, memberships }, "menu:edit", { projectId: id });
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();
  const menu = await getDraftMenu(id);
  const versions = await prisma.menuVersion.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, note: true },
  });

  return (
    <MenuEditor
      projectId={id}
      projectName={project.name}
      slug={project.slug}
      initialCategories={menu.categories.map((c) => ({
        id: c.id,
        name: c.name as { ru: string; kk?: string; en?: string },
        sort: c.sort,
      }))}
      initialItems={menu.items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name as { ru: string; kk?: string; en?: string },
        price: i.price,
        available: i.available,
        sort: i.sort,
        volume: i.volume,
      }))}
      versions={versions.map((v) => ({
        id: v.id,
        createdAt: v.createdAt.toISOString(),
        note: v.note,
      }))}
    />
  );
}
