import { prisma } from "@/lib/db";
import type { Prisma, ProjectStatus } from "@prisma/client";

export async function listProjectsForUser(userId: string, isStudioAdmin: boolean) {
  if (isStudioAdmin) {
    return prisma.project.findMany({ orderBy: { updatedAt: "desc" } });
  }
  return prisma.project.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProjectById(projectId: string) {
  return prisma.project.findUnique({ where: { id: projectId } });
}

export async function getProjectBySlug(slug: string) {
  return prisma.project.findUnique({ where: { slug } });
}

export async function createProject(data: {
  name: string;
  slug: string;
  ownerId?: string;
  themeId?: string;
  demo?: boolean;
  status?: ProjectStatus;
  serviceChargePercent?: number;
  features?: Prisma.InputJsonValue;
  contacts?: Prisma.InputJsonValue;
}) {
  return prisma.project.create({
    data: {
      name: data.name,
      slug: data.slug,
      ownerId: data.ownerId,
      themeId: data.themeId ?? "classic-green",
      demo: data.demo ?? false,
      status: data.status ?? "draft",
      serviceChargePercent: data.serviceChargePercent ?? 0,
      features: data.features ?? {
        billCalculator: true,
        search: true,
        languages: true,
        gallery: true,
        waiters: false,
        hideBranding: false,
      },
      contacts: data.contacts ?? {},
    },
  });
}

export async function updateProject(
  projectId: string,
  data: Prisma.ProjectUpdateInput,
) {
  return prisma.project.update({ where: { id: projectId }, data });
}
