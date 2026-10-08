import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";

export default async function AnalyticsPage({
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
  assertCan({ ...user!, memberships }, "analytics:read", { projectId: id });
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [scans, views, taps] = await Promise.all([
    prisma.scanEvent.findMany({
      where: { projectId: id, day: { gte: since } },
    }),
    prisma.menuView.findMany({
      where: { projectId: id, day: { gte: since } },
    }),
    prisma.itemTap.findMany({
      where: { projectId: id, day: { gte: since } },
      orderBy: { count: "desc" },
      take: 10,
    }),
  ]);

  const scanTotal = scans.reduce((s, r) => s + r.count, 0);
  const viewTotal = views.reduce((s, r) => s + r.count, 0);
  const maxScan = Math.max(1, ...scans.map((s) => s.count));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl">Аналитика · {project.name}</h1>
        <a
          className="text-sm text-[var(--leaf)] underline"
          href={`/api/projects/${id}/analytics?format=csv&days=30`}
        >
          CSV
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
          <div className="text-xs text-[var(--stone)]">Сканы · 30 дней</div>
          <div className="font-display text-3xl">{scanTotal}</div>
        </div>
        <div className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
          <div className="text-xs text-[var(--stone)]">Просмотры · 30 дней</div>
          <div className="font-display text-3xl">{viewTotal}</div>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
        <h2 className="font-semibold mb-3">Сканы по дням</h2>
        <div className="flex items-end gap-1 h-32">
          {scans.map((s) => (
            <div
              key={s.id}
              className="flex-1 rounded-t bg-[var(--lime)]"
              style={{ height: `${(s.count / maxScan) * 100}%` }}
              title={`${s.day.toISOString().slice(0, 10)}: ${s.count}`}
            />
          ))}
          {!scans.length && (
            <p className="text-sm text-[var(--stone)]">Пока нет данных</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
        <h2 className="font-semibold mb-3">Топ блюд (открытия)</h2>
        <ul className="space-y-1 text-sm">
          {taps.map((t) => (
            <li key={t.id} className="flex justify-between">
              <span>{t.itemId}</span>
              <span>{t.count}</span>
            </li>
          ))}
          {!taps.length && (
            <li className="text-[var(--stone)]">Пока нет данных</li>
          )}
        </ul>
      </div>
    </div>
  );
}
