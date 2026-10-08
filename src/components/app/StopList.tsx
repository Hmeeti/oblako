"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export function StopList({
  projectId,
  projectName,
  items: initial,
}: {
  projectId: string;
  projectName: string;
  items: Array<{ id: string; name: string; available: boolean; price: number }>;
}) {
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const nq = q.toLowerCase().replace(/ё/g, "е");
    return items.filter((i) =>
      i.name.toLowerCase().replace(/ё/g, "е").includes(nq),
    );
  }, [items, q]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Стоп-лист · {projectName}</h1>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск"
      />
      <ul className="space-y-2">
        {filtered.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--ink)]/10 bg-white px-4 py-3"
          >
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-xs text-[var(--stone)]">
                {item.price.toLocaleString("ru-KZ")} ₸
              </div>
            </div>
            <button
              type="button"
              className={`min-h-12 min-w-24 rounded-2xl px-4 text-sm font-semibold ${
                item.available
                  ? "bg-[var(--lime)] text-[var(--ink)]"
                  : "bg-[var(--coral)] text-white"
              }`}
              onClick={async () => {
                const available = !item.available;
                setItems((prev) =>
                  prev.map((p) =>
                    p.id === item.id ? { ...p, available } : p,
                  ),
                );
                const res = await fetch(`/api/projects/${projectId}/stoplist`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ itemId: item.id, available }),
                });
                if (!res.ok) {
                  setItems((prev) =>
                    prev.map((p) =>
                      p.id === item.id ? { ...p, available: !available } : p,
                    ),
                  );
                }
              }}
            >
              {item.available ? "Есть" : "Нет"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
