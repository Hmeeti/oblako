import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/can";
import { getLead } from "@/server/repositories/leads";
import { LeadActions } from "@/components/app/LeadActions";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!can(user, "lead:read")) redirect("/app/projects");
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  return (
    <div className="space-y-4">
      <Link href="/app/leads" className="text-sm text-[var(--leaf)]">
        ← К заявкам
      </Link>
      <h1 className="font-display text-2xl">{lead.name}</h1>
      <dl className="grid gap-2 rounded-2xl border border-[var(--ink)]/10 bg-white p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--stone)]">Телефон</dt>
          <dd>{lead.phone}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--stone)]">Связь</dt>
          <dd>{lead.contactMethod}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--stone)]">Заведение</dt>
          <dd>{lead.venueName || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--stone)]">Город</dt>
          <dd>{lead.city || "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--stone)]">Сообщение</dt>
          <dd className="mt-1">{lead.message || "—"}</dd>
        </div>
      </dl>
      <LeadActions leadId={lead.id} status={lead.status} phone={lead.phone} />
    </div>
  );
}
