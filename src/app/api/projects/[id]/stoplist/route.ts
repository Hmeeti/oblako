import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import {
  setItemAvailability,
  updateItemPrice,
  getDraftMenu,
  getPublishedSnapshot,
} from "@/server/repositories/menu";
import { getProjectById } from "@/server/repositories/projects";

async function auth() {
  const user = await getSessionUser();
  if (!user) return null;
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true },
  });
  return { ...user, memberships };
}

const schema = z.object({
  itemId: z.string(),
  available: z.boolean().optional(),
  price: z.number().int().min(0).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await auth();
  assertCan(user, "menu:publish", { projectId: id });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (parsed.data.available !== undefined) {
    await setItemAvailability(id, parsed.data.itemId, parsed.data.available);
  }
  if (parsed.data.price !== undefined) {
    await updateItemPrice(id, parsed.data.itemId, parsed.data.price);
  }

  // Fast path: patch latest published snapshot in-place
  const published = await getPublishedSnapshot(id);
  if (published) {
    const snap = published.snapshot as {
      items: Array<{ id: string; available?: boolean; price?: number }>;
    };
    const items = (snap.items ?? []).map((item) =>
      item.id === parsed.data.itemId
        ? {
            ...item,
            available:
              parsed.data.available !== undefined
                ? parsed.data.available
                : item.available,
            price:
              parsed.data.price !== undefined ? parsed.data.price : item.price,
          }
        : item,
    );
    await prisma.menuVersion.update({
      where: { id: published.id },
      data: { snapshot: { ...snap, items } },
    });
  }

  await prisma.auditLog.create({
    data: {
      projectId: id,
      userId: user!.id,
      action: "menu.stoplist",
      meta: parsed.data,
    },
  });
  const project = await getProjectById(id);
  if (project) revalidatePath(`/m/${project.slug}`);
  const draft = await getDraftMenu(id);
  return NextResponse.json({ ok: true, items: draft.items });
}
