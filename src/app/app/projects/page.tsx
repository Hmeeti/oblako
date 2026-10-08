import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { listProjectsForUser } from "@/server/repositories/projects";
import { CreateProjectForm } from "@/components/app/CreateProjectForm";
import { can } from "@/lib/auth/can";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  const projects = await listProjectsForUser(
    user!.id,
    user!.platformRole === "studio_admin",
  );
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Проекты</h1>
      {can(user, "project:create") && <CreateProjectForm />}
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/app/projects/${p.id}`}
              className="block rounded-2xl border border-[var(--ink)]/10 bg-white p-4"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-[var(--stone)]">
                /m/{p.slug} · {p.status}
                {p.demo ? " · demo" : ""}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
