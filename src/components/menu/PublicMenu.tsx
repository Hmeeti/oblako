"use client";

import { useEffect, useMemo, useState } from "react";
import { brand, type Locale } from "@/config/brand";
import type { MenuTheme } from "@/lib/themes";

type Localized = { ru?: string; kk?: string; en?: string };

export type PublicMenuData = {
  project: {
    name: string;
    slug: string;
    serviceChargePercent: number;
    features: Record<string, unknown>;
    contacts: Record<string, unknown>;
    allergyNote?: Localized | null;
    logo?: string | null;
  };
  categories: Array<{
    id: string;
    name: Localized;
    group?: string | null;
    sort: number;
  }>;
  items: Array<{
    id: string;
    categoryId: string;
    name: Localized;
    description?: Localized | null;
    price: number;
    volume?: string | null;
    available: boolean;
    popular: boolean;
    photos: Array<{ webp?: string; jpg?: string }>;
    tags?: string[];
  }>;
  theme: MenuTheme;
  tableNumber?: number | null;
  embed?: boolean;
};

function pick(loc: Locale, value?: Localized | null) {
  if (!value) return "";
  return value[loc] || value.ru || value.en || value.kk || "";
}

function normalize(s: string) {
  return s.toLowerCase().replace(/ё/g, "е");
}

export function PublicMenu({ data }: { data: PublicMenuData }) {
  const features = data.project.features || {};
  const [locale, setLocale] = useState<Locale>("ru");
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState(data.categories[0]?.id);
  const [billOpen, setBillOpen] = useState(false);
  const [lines, setLines] = useState<
    Array<{ id: string; name: string; price: number; qty: number }>
  >([]);
  const [table, setTable] = useState(String(data.tableNumber ?? ""));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`stolio-bill:${data.project.slug}`);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [data.project.slug]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `stolio-bill:${data.project.slug}`,
        JSON.stringify(lines),
      );
    } catch {
      /* ignore */
    }
  }, [lines, data.project.slug]);

  useEffect(() => {
    if (data.embed) return;
    void fetch("/api/public/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: data.project.slug,
        locale,
        themeMode: "auto",
      }),
    }).catch(() => undefined);
  }, [data.embed, data.project.slug, locale]);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    return data.items.filter((item) => {
      if (!nq) return true;
      const hay = normalize(
        `${pick(locale, item.name)} ${pick(locale, item.description)}`,
      );
      return hay.includes(nq);
    });
  }, [data.items, locale, q]);

  const byCat = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const arr = map.get(item.categoryId) ?? [];
      arr.push(item);
      map.set(item.categoryId, arr);
    }
    return map;
  }, [filtered]);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const service = Math.round(
    (subtotal * (data.project.serviceChargePercent || 0)) / 100,
  );
  const total = subtotal + service;
  const t = data.theme.tokens;

  function addItem(item: (typeof data.items)[number]) {
    if (!item.available) return;
    setLines((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) =>
          p.id === item.id ? { ...p, qty: p.qty + 1 } : p,
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: pick(locale, item.name),
          price: item.price,
          qty: 1,
        },
      ];
    });
  }

  return (
    <div
      className="min-h-[100dvh]"
      style={
        {
          background: t.bg,
          color: t.ink,
          "--menu-accent": t.accent,
          "--menu-accent-ink": t.accentInk,
          "--menu-surface": t.surface,
          "--menu-muted": t.muted,
          "--menu-radius": t.radius,
        } as React.CSSProperties
      }
    >
      {!data.embed && (
        <header className="sticky top-0 z-30 border-b px-4 py-3 backdrop-blur"
          style={{
            borderColor: `${t.ink}18`,
            background: `${t.bg}ee`,
          }}
        >
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div>
              <div className="font-display text-xl">{data.project.name}</div>
              {features.search !== false && (
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Поиск"
                  className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2 text-base"
                  style={{ borderColor: `${t.ink}22` }}
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <select
                aria-label="Язык"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="rounded-xl border px-2 py-2 text-sm min-h-11"
                style={{ borderColor: `${t.ink}22`, background: t.surface }}
              >
                <option value="ru">RU</option>
                <option value="kk">KK</option>
                <option value="en">EN</option>
              </select>
              {features.billCalculator !== false && (
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm font-medium min-h-11"
                  style={{ background: t.accent, color: t.accentInk }}
                  onClick={() => setBillOpen(true)}
                >
                  Счёт · {total.toLocaleString("ru-KZ")} ₸
                </button>
              )}
            </div>
          </div>
          <div className="mx-auto mt-3 flex max-w-xl gap-2 overflow-x-auto pb-1">
            {data.categories.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                onClick={() => setActiveCat(c.id)}
                className="whitespace-nowrap rounded-full px-3 py-2 text-sm min-h-11 inline-flex items-center"
                style={{
                  background: activeCat === c.id ? t.accent : t.surface,
                  color: activeCat === c.id ? t.accentInk : t.ink,
                }}
              >
                {pick(locale, c.name)}
              </a>
            ))}
          </div>
        </header>
      )}

      <main className="mx-auto max-w-xl px-4 py-4 pb-24 space-y-8">
        {data.categories.map((cat) => {
          const items = byCat.get(cat.id) ?? [];
          if (!items.length) return null;
          return (
            <section key={cat.id} id={`cat-${cat.id}`}>
              <h2 className="font-display text-2xl mb-3">{pick(locale, cat.name)}</h2>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex gap-3 p-3"
                    style={{
                      background: t.surface,
                      borderRadius: t.radius,
                      opacity: item.available ? 1 : 0.55,
                    }}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => {
                        void fetch("/api/public/tap", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            slug: data.project.slug,
                            itemId: item.id,
                          }),
                        }).catch(() => undefined);
                        addItem(item);
                      }}
                    >
                      <div className="font-medium">{pick(locale, item.name)}</div>
                      {item.volume && (
                        <div className="text-sm" style={{ color: t.muted }}>
                          {item.volume}
                        </div>
                      )}
                      <div className="mt-1 font-semibold">
                        {item.available
                          ? `${item.price.toLocaleString("ru-KZ")} ₸`
                          : "Нет в наличии"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {data.project.allergyNote && (
          <p className="text-sm" style={{ color: t.muted }}>
            {pick(locale, data.project.allergyNote)}
          </p>
        )}

        {features.hideBranding !== true && (
          <p className="text-center text-xs opacity-60">{brand.madeWith.ru}</p>
        )}
      </main>

      {billOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть"
            onClick={() => setBillOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5"
            style={{ background: t.surface, color: t.ink }}
          >
            <h3 className="font-display text-xl mb-3">Счёт</h3>
            <label className="block text-sm mb-3">
              Стол №
              <input
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-base"
                style={{ borderColor: `${t.ink}22` }}
              />
            </label>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span>
                    {l.name} × {l.qty}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="min-h-11 min-w-11"
                      onClick={() =>
                        setLines((prev) =>
                          prev
                            .map((p) =>
                              p.id === l.id ? { ...p, qty: p.qty - 1 } : p,
                            )
                            .filter((p) => p.qty > 0),
                        )
                      }
                    >
                      −
                    </button>
                    <span>{(l.price * l.qty).toLocaleString("ru-KZ")} ₸</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Сумма</span>
                <span>{subtotal.toLocaleString("ru-KZ")} ₸</span>
              </div>
              <div className="flex justify-between">
                <span>Обслуживание {data.project.serviceChargePercent}%</span>
                <span>{service.toLocaleString("ru-KZ")} ₸</span>
              </div>
              <div className="flex justify-between font-semibold text-base">
                <span>Итого</span>
                <span>{total.toLocaleString("ru-KZ")} ₸</span>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-xl py-3 min-h-11"
              style={{ background: t.accent, color: t.accentInk }}
              onClick={() => setBillOpen(false)}
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
