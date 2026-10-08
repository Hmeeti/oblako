import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { deviceClassFromUa } from "@/lib/utils";

const schema = z.object({
  slug: z.string(),
  locale: z.string().default("ru"),
  themeMode: z.string().default("light"),
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
  const deviceClass = deviceClassFromUa(req.headers.get("user-agent"));
  await prisma.menuView.upsert({
    where: {
      projectId_day_locale_deviceClass_themeMode: {
        projectId: project.id,
        day,
        locale: parsed.data.locale,
        deviceClass,
        themeMode: parsed.data.themeMode,
      },
    },
    create: {
      projectId: project.id,
      day,
      count: 1,
      locale: parsed.data.locale,
      deviceClass,
      themeMode: parsed.data.themeMode,
    },
    update: { count: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
