import { brand } from "@/config/brand";

export default function MorePage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Ещё</h1>
      <ul className="space-y-2 text-sm">
        <li className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
          Пользователи и доступы — управление ролями (studio_admin). TODO: UI
          приглашений клиентов — Фаза 2.
        </li>
        <li className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
          Установите приложение: Android — «Установить», iOS — Поделиться → На экран
          «Домой». start_url: /app
        </li>
        <li className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
          Бренд: {brand.name}. Домен: {brand.domain} (проверить свободу .kz/.com/.app и
          товарный знак до рекламы).
        </li>
      </ul>
    </div>
  );
}
