import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { listProjectsForUser } from "@/server/repositories/projects";
import { Button } from "@/components/ui/button";

export default async function AppHomePage() {
  const user = await getSessionUser();
  const projects = await listProjectsForUser(
    user!.id,
    user!.platformRole === "studio_admin",
  );
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Быстрый доступ к меню</h1>
      <p className="text-sm text-[var(--stone)]">
        Выберите проект, чтобы открыть редактор или стоп-лист.
      </p>
      <ul className="space-y-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4"
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-[var(--stone)]">/{p.slug} · {p.status}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/app/projects/${p.id}/menu`}>
                <Button size="sm">Редактор</Button>
              </Link>
              <Link href={`/app/stoplist/${p.id}`}>
                <Button size="sm" variant="ghost">
                  Стоп-лист
                </Button>
              </Link>
              <Link href={`/m/${p.slug}`} target="_blank">
                <Button size="sm" variant="secondary">
                  Публично
                </Button>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
