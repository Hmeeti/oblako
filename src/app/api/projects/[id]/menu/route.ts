import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { getDraftMenu } from "@/server/repositories/menu";

async function auth() {
  const user = await getSessionUser();
  if (!user) return null;
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true },
  });
  return { ...user, memberships };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await auth();
  assertCan(user, "menu:edit", { projectId: id });
  const menu = await getDraftMenu(id);
  const versions = await prisma.menuVersion.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, createdAt: true, note: true, createdById: true },
  });
  return NextResponse.json({ ...menu, versions });
}

const categorySchema = z.object({
  name: z.object({
    ru: z.string().min(1),
    kk: z.string().optional(),
    en: z.string().optional(),
  }),
  group: z.string().optional(),
  sort: z.number().int().optional(),
});

const itemSchema = z.object({
  categoryId: z.string(),
  name: z.object({
    ru: z.string().min(1),
    kk: z.string().optional(),
    en: z.string().optional(),
  }),
  description: z
    .object({
      ru: z.string().optional(),
      kk: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
  price: z.number().int().min(0),
  volume: z.string().optional(),
  available: z.boolean().optional(),
  popular: z.boolean().optional(),
  sort: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  photos: z.array(z.unknown()).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await auth();
  assertCan(user, "menu:edit", { projectId: id });
  const body = await req.json().catch(() => null);
  const type = body?.type as string;

  if (type === "category") {
    const parsed = categorySchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const max = await prisma.category.aggregate({
      where: { projectId: id },
      _max: { sort: true },
    });
    const category = await prisma.category.create({
      data: {
        projectId: id,
        name: parsed.data.name,
        group: parsed.data.group,
        sort: parsed.data.sort ?? (max._max.sort ?? 0) + 1,
      },
    });
    return NextResponse.json({ category });
  }

  if (type === "item") {
    const parsed = itemSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const cat = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, projectId: id },
    });
    if (!cat) return NextResponse.json({ error: "bad_category" }, { status: 400 });
    const max = await prisma.item.aggregate({
      where: { projectId: id, categoryId: cat.id },
      _max: { sort: true },
    });
    const item = await prisma.item.create({
      data: {
        projectId: id,
        categoryId: cat.id,
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        volume: parsed.data.volume,
        available: parsed.data.available ?? true,
        popular: parsed.data.popular ?? false,
        sort: parsed.data.sort ?? (max._max.sort ?? 0) + 1,
        tags: parsed.data.tags ?? [],
        photos: (parsed.data.photos ?? []) as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ item });
  }

  return NextResponse.json({ error: "unknown_type" }, { status: 400 });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await auth();
  assertCan(user, "menu:edit", { projectId: id });
  const body = await req.json().catch(() => null);
  if (body?.type === "item" && body.id) {
    const item = await prisma.item.updateMany({
      where: { id: body.id, projectId: id },
      data: body.data ?? {},
    });
    return NextResponse.json({ ok: true, count: item.count });
  }
  if (body?.type === "category" && body.id) {
    const category = await prisma.category.updateMany({
      where: { id: body.id, projectId: id },
      data: body.data ?? {},
    });
    return NextResponse.json({ ok: true, count: category.count });
  }
  if (body?.type === "reorder") {
    const updates = z
      .array(z.object({ id: z.string(), sort: z.number().int(), kind: z.enum(["item", "category"]) }))
      .safeParse(body.items);
    if (!updates.success) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await prisma.$transaction(
      updates.data.map((row) =>
        row.kind === "item"
          ? prisma.item.updateMany({
              where: { id: row.id, projectId: id },
              data: { sort: row.sort },
            })
          : prisma.category.updateMany({
              where: { id: row.id, projectId: id },
              data: { sort: row.sort },
            }),
      ),
    );
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "invalid" }, { status: 400 });
}
