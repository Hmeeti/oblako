import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  slug: z.string(),
  itemId: z.string(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true });
  const project = await prisma.project.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (!project) return NextResponse.json({ ok: true });
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  await prisma.itemTap.upsert({
    where: {
      projectId_itemId_day: {
        projectId: project.id,
        itemId: parsed.data.itemId,
        day,
      },
    },
    create: {
      projectId: project.id,
      itemId: parsed.data.itemId,
      day,
      count: 1,
    },
    update: { count: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
