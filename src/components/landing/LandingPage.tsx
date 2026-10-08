"use client";

import { useState } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { LeadSheet } from "@/components/landing/LeadSheet";
import { menuThemes, type MenuThemeId } from "@/lib/themes";

const FEATURES = [
  "QR на каждый стол",
  "Стоп-лист с телефона",
  "Языки RU / KK / EN",
  "Счёт-калькулятор",
  "Фото блюд",
  "Базовая статистика",
];

const STEPS = [
  { t: "Заявка", d: "Оставляете контакты — мы связываемся сразу." },
  { t: "Меню", d: "Собираем категории, цены и фото в редакторе." },
  { t: "QR на столах", d: "Гости сканируют — меню открывается за секунду." },
];

export function LandingPage() {
  const [leadOpen, setLeadOpen] = useState(false);
  const [themeId, setThemeId] = useState<MenuThemeId>("classic-green");
  const theme = menuThemes[themeId];

  return (
    <div className="min-h-[100dvh] bg-[var(--cream)] text-[var(--ink)]">
      <header className="sticky top-0 z-40 border-b border-[color-mix(in_oklab,var(--ink)_8%,transparent)] bg-[color-mix(in_oklab,var(--cream)_92%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2" aria-label="Stolio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon.svg" alt="" width={36} height={36} />
            <span className="font-display text-xl tracking-tight">{brand.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:inline text-sm text-[var(--stone)]">
              Кабинет
            </Link>
            <Button size="sm" onClick={() => setLeadOpen(true)}>
              Заявка
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-10 pt-10 sm:pt-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 top-8 size-64 rounded-full bg-[var(--lime)]/30 blur-3xl motion-safe:animate-[float_8s_ease-in-out_infinite]"
          />
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                {brand.name}
              </p>
              <h1 className="mt-4 max-w-xl text-2xl font-medium leading-snug sm:text-3xl">
                Электронное меню для вашего заведения — без программистов
              </h1>
              <p className="mt-2 text-xs text-[var(--stone)]">
                TODO: согласовать с владельцем формулировку сроков (например «за 1 день»).
              </p>
              <p className="mt-4 max-w-lg text-base text-[var(--stone)] sm:text-lg">
                {brand.tagline.ru}. Стоп-лист и цены обновляются за секунды.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => setLeadOpen(true)}>
                  Оставить заявку
                </Button>
                <Link href="/m/park-avenue">
                  <Button size="lg" variant="ghost">
                    Посмотреть пример
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[320px]">
              <div className="absolute -left-6 -top-6 size-20 rounded-2xl border border-[var(--ink)]/10 bg-white p-2 shadow-sm motion-safe:animate-[pulseSoft_3s_ease-in-out_infinite]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/icon.svg" alt="" className="size-full" />
              </div>
              <div
                className="overflow-hidden rounded-[2rem] border-8 border-[var(--ink)] shadow-2xl"
                style={{ background: theme.tokens.bg, color: theme.tokens.ink }}
              >
                <div className="border-b px-4 py-3" style={{ borderColor: `${theme.tokens.ink}22` }}>
                  <div className="text-xs opacity-60">Демо-меню</div>
                  <div className="font-display text-lg">Park Avenue</div>
                </div>
                <iframe
                  title="Демо меню"
                  src={`/m/park-avenue?embed=1&theme=${themeId}`}
                  className="h-[420px] w-full bg-transparent"
                />
              </div>
              <div className="mt-4 flex gap-2">
                {(Object.keys(menuThemes) as MenuThemeId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setThemeId(id)}
                    className={`flex-1 rounded-xl border px-2 py-2 text-xs min-h-11 ${
                      themeId === id
                        ? "border-[var(--ink)] bg-[var(--lime)]"
                        : "border-[var(--ink)]/15 bg-white"
                    }`}
                  >
                    {menuThemes[id].name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-display text-3xl">Как это работает</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative">
                <div className="font-display text-5xl text-[var(--lime)]">{i + 1}</div>
                <h3 className="mt-2 text-xl font-semibold">{s.t}</h3>
                <p className="mt-1 text-[var(--stone)]">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-[var(--ink)] px-4 py-14 text-[var(--cream)]">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-3xl">Что входит</h2>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li
                  key={f}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-display text-3xl">Примеры работ</h2>
          <p className="mt-3 text-[var(--stone)]">
            TODO: добавить реальные проекты студии только с согласия клиентов.
          </p>
          <div className="mt-6">
            <Link
              href="/m/park-avenue"
              className="inline-flex rounded-2xl border border-[var(--ink)]/10 bg-white px-5 py-4 shadow-sm"
            >
              Park Avenue Hotel &amp; Cafe — демо-меню
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-display text-3xl">Тарифы</h2>
          <p className="mt-3 max-w-xl text-[var(--stone)]">
            Цена по запросу. TODO: заполнить тарифы, когда будут утверждены владельцем.
          </p>
          <Button className="mt-6" onClick={() => setLeadOpen(true)}>
            Узнать стоимость
          </Button>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-display text-3xl">Вопросы и ответы</h2>
          <dl className="mt-6 space-y-4">
            <div>
              <dt className="font-semibold">Нужен ли свой сайт?</dt>
              <dd className="text-[var(--stone)]">
                Нет. Гости открывают меню по QR — отдельный сайт не обязателен.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Можно менять цены с телефона?</dt>
              <dd className="text-[var(--stone)]">
                Да. Стоп-лист и цены публикуются за секунды.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Где хранятся данные?</dt>
              <dd className="text-[var(--stone)]">
                Рекомендуем VPS в Казахстане. TODO: согласовать с юристом хранение ПДн.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-display text-3xl">Контакты</h2>
          <ul className="mt-4 space-y-2 text-[var(--stone)]">
            <li>Телефон / WhatsApp: {brand.contacts.phone}</li>
            <li>Telegram: {brand.contacts.telegram}</li>
            <li>Email: {brand.contacts.email}</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-[var(--ink)]/10 px-4 py-8 text-sm text-[var(--stone)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} {brand.name}</span>
          <Link href="/privacy" className="underline">
            Политика конфиденциальности
          </Link>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ink)]/10 bg-[var(--cream)]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button className="flex-1" onClick={() => setLeadOpen(true)}>
            Заявка
          </Button>
          {brand.contacts.whatsapp !== "TODO" ? (
            <a
              className="flex-1"
              href={`https://wa.me/${brand.contacts.whatsapp.replace(/\D/g, "")}`}
            >
              <Button variant="secondary" className="w-full">
                WhatsApp
              </Button>
            </a>
          ) : (
            <Button variant="ghost" className="flex-1" disabled>
              WhatsApp TODO
            </Button>
          )}
        </div>
      </div>

      <LeadSheet open={leadOpen} onClose={() => setLeadOpen(false)} />

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(12px);
          }
        }
        @keyframes pulseSoft {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.03);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
