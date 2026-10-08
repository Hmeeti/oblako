import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { getProjectById } from "@/server/repositories/projects";
import { Button } from "@/components/ui/button";
import { ProjectSettingsForm } from "@/components/app/ProjectSettingsForm";

export default async function ProjectPage({
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
  assertCan({ ...user!, memberships }, "project:read", { projectId: id });
  const project = await getProjectById(id);
  if (!project) notFound();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">{project.name}</h1>
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/projects/${id}/menu`}>
          <Button>Редактор меню</Button>
        </Link>
        <Link href={`/app/stoplist/${id}`}>
          <Button variant="ghost">Стоп-лист</Button>
        </Link>
        <Link href={`/app/projects/${id}/qr`}>
          <Button variant="secondary">QR-коды</Button>
        </Link>
        <Link href={`/app/projects/${id}/analytics`}>
          <Button variant="ghost">Аналитика</Button>
        </Link>
        <Link href={`/m/${project.slug}`} target="_blank">
          <Button variant="ghost">Открыть меню</Button>
        </Link>
      </div>
      <ProjectSettingsForm
        projectId={project.id}
        initial={{
          name: project.name,
          status: project.status,
          themeId: project.themeId,
          serviceChargePercent: project.serviceChargePercent,
        }}
      />
    </div>
  );
}
