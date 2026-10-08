import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/can";
import { listLeads } from "@/server/repositories/leads";

export default async function LeadsPage() {
  const user = await getSessionUser();
  if (!can(user, "lead:read")) redirect("/app/projects");
  const leads = await listLeads();
  const telegramReady = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
  );

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Заявки</h1>
      {!telegramReady && (
        <div className="rounded-2xl border border-[var(--coral)]/30 bg-white p-4 text-sm">
          Подключите Telegram: задайте <code>TELEGRAM_BOT_TOKEN</code> и{" "}
          <code>TELEGRAM_CHAT_ID</code> в `.env`.
        </div>
      )}
      <ul className="space-y-2">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link
              href={`/app/leads/${lead.id}`}
              className="block rounded-2xl border border-[var(--ink)]/10 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{lead.name}</span>
                <span className="rounded-full bg-[var(--lime)]/40 px-2 py-0.5 text-xs">
                  {lead.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-[var(--stone)]">
                {lead.phone} · {lead.venueName || "без названия"} ·{" "}
                {lead.city || "—"}
              </div>
            </Link>
          </li>
        ))}
        {!leads.length && (
          <li className="rounded-2xl border border-dashed border-[var(--ink)]/15 p-8 text-center text-[var(--stone)]">
            Заявок пока нет
          </li>
        )}
      </ul>
    </div>
  );
}
