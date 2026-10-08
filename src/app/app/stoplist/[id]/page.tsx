import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { getDraftMenu } from "@/server/repositories/menu";
import { StopList } from "@/components/app/StopList";

export default async function StopListPage({
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
  assertCan({ ...user!, memberships }, "menu:publish", { projectId: id });
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();
  const menu = await getDraftMenu(id);
  return (
    <StopList
      projectId={id}
      projectName={project.name}
      items={menu.items.map((i) => ({
        id: i.id,
        name: (i.name as { ru: string }).ru,
        available: i.available,
        price: i.price,
      }))}
    />
  );
}
