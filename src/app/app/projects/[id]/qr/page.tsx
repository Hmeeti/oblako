import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { QrManager } from "@/components/app/QrManager";

export default async function QrPage({
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
  assertCan({ ...user!, memberships }, "qr:manage", { projectId: id });
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();
  const codes = await prisma.qrCode.findMany({
    where: { projectId: id },
    orderBy: [{ tableNumber: "asc" }, { createdAt: "asc" }],
  });
  return (
    <QrManager
      projectId={id}
      projectName={project.name}
      initialCodes={codes.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        tableNumber: c.tableNumber,
      }))}
    />
  );
}
