import Link from "next/link";
import { brand } from "@/config/brand";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-4">
      <Link href="/" className="text-sm text-[var(--leaf)]">
        ← {brand.name}
      </Link>
      <h1 className="font-display text-3xl">Политика конфиденциальности</h1>
      <p className="text-[var(--stone)]">
        TODO: заменить этот черновик на утверждённый юридический текст (РК).
      </p>
      <p>
        Мы обрабатываем имя и телефон из заявок только для связи по запросу услуги
        электронного меню. Данные заявок доступны администраторам студии. Срок
        хранения и удаление по запросу — уточняются в финальной редакции.
      </p>
      <p>
        Контакт: {brand.contacts.email} (заполните в `.env` / `brand.ts`).
      </p>
    </main>
  );
}
