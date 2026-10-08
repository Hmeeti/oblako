import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";

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
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await auth();
  assertCan(user, "analytics:read", { projectId: id });
  const days = Number(new URL(req.url).searchParams.get("days") || 30);
  const since = new Date();
  since.setDate(since.getDate() - Math.min(Math.max(days, 7), 90));

  const [scans, views, taps] = await Promise.all([
    prisma.scanEvent.findMany({
      where: { projectId: id, day: { gte: since } },
      orderBy: { day: "asc" },
    }),
    prisma.menuView.findMany({
      where: { projectId: id, day: { gte: since } },
      orderBy: { day: "asc" },
    }),
    prisma.itemTap.findMany({
      where: { projectId: id, day: { gte: since } },
      orderBy: { count: "desc" },
      take: 20,
    }),
  ]);

  const format = new URL(req.url).searchParams.get("format");
  if (format === "csv") {
    const lines = ["type,day,count,meta"];
    for (const s of scans) {
      lines.push(`scan,${s.day.toISOString().slice(0, 10)},${s.count},${s.deviceClass}`);
    }
    for (const v of views) {
      lines.push(
        `view,${v.day.toISOString().slice(0, 10)},${v.count},${v.locale}/${v.themeMode}`,
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-${id}.csv"`,
      },
    });
  }

  return NextResponse.json({ scans, views, taps, since });
}
