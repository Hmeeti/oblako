import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deviceClassFromUa } from "@/lib/utils";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const qr = await prisma.qrCode.findUnique({
    where: { code },
    include: { project: true },
  });
  if (!qr || qr.project.status === "paused") {
    return NextResponse.redirect(new URL("/m/not-found", req.url));
  }

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const deviceClass = deviceClassFromUa(req.headers.get("user-agent"));
  await prisma.scanEvent.upsert({
    where: {
      qrCodeId_day_deviceClass: {
        qrCodeId: qr.id,
        day,
        deviceClass,
      },
    },
    create: {
      projectId: qr.projectId,
      qrCodeId: qr.id,
      day,
      count: 1,
      deviceClass,
    },
    update: { count: { increment: 1 } },
  });

  const url = new URL(`/m/${qr.project.slug}`, req.url);
  if (qr.tableNumber != null) url.searchParams.set("t", String(qr.tableNumber));
  return NextResponse.redirect(url, 302);
}
