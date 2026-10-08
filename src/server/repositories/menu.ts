import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function getDraftMenu(projectId: string) {
  const [categories, items] = await Promise.all([
    prisma.category.findMany({
      where: { projectId },
      orderBy: { sort: "asc" },
    }),
    prisma.item.findMany({
      where: { projectId },
      orderBy: { sort: "asc" },
    }),
  ]);
  return { categories, items };
}

export async function getPublishedSnapshot(projectId: string) {
  return prisma.menuVersion.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function publishMenu(
  projectId: string,
  userId: string | null,
  note?: string,
) {
  const draft = await getDraftMenu(projectId);
  return prisma.menuVersion.create({
    data: {
      projectId,
      snapshot: draft as unknown as Prisma.InputJsonValue,
      createdById: userId ?? undefined,
      note,
    },
  });
}

export async function rollbackMenu(projectId: string, versionId: string) {
  const version = await prisma.menuVersion.findFirst({
    where: { id: versionId, projectId },
  });
  if (!version) return null;
  const snap = version.snapshot as {
    categories: Array<Record<string, unknown>>;
    items: Array<Record<string, unknown>>;
  };

  await prisma.$transaction(async (tx) => {
    await tx.item.deleteMany({ where: { projectId } });
    await tx.category.deleteMany({ where: { projectId } });
    for (const c of snap.categories ?? []) {
      await tx.category.create({
        data: {
          id: String(c.id),
          projectId,
          name: c.name as Prisma.InputJsonValue,
          group: (c.group as string | null) ?? null,
          sort: Number(c.sort ?? 0),
        },
      });
    }
    for (const i of snap.items ?? []) {
      await tx.item.create({
        data: {
          id: String(i.id),
          projectId,
          categoryId: String(i.categoryId),
          name: i.name as Prisma.InputJsonValue,
          description: (i.description as Prisma.InputJsonValue) ?? undefined,
          price: Number(i.price ?? 0),
          variants: (i.variants as Prisma.InputJsonValue) ?? undefined,
          volume: (i.volume as string | null) ?? null,
          photos: (i.photos as Prisma.InputJsonValue) ?? [],
          tags: (i.tags as string[]) ?? [],
          allergens: (i.allergens as string[]) ?? [],
          available: Boolean(i.available ?? true),
          popular: Boolean(i.popular ?? false),
          sort: Number(i.sort ?? 0),
        },
      });
    }
  });
  return version;
}

export async function setItemAvailability(
  projectId: string,
  itemId: string,
  available: boolean,
) {
  return prisma.item.updateMany({
    where: { id: itemId, projectId },
    data: { available },
  });
}

export async function updateItemPrice(
  projectId: string,
  itemId: string,
  price: number,
) {
  return prisma.item.updateMany({
    where: { id: itemId, projectId },
    data: { price },
  });
}
