"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Cat = { id: string; name: { ru: string; kk?: string; en?: string }; sort: number };
type Item = {
  id: string;
  categoryId: string;
  name: { ru: string; kk?: string; en?: string };
  price: number;
  available: boolean;
  sort: number;
  volume?: string | null;
};

export function MenuEditor({
  projectId,
  projectName,
  slug,
  initialCategories,
  initialItems,
  versions,
}: {
  projectId: string;
  projectName: string;
  slug: string;
  initialCategories: Cat[];
  initialItems: Item[];
  versions: Array<{ id: string; createdAt: string; note: string | null }>;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [msg, setMsg] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("0");
  const [itemCat, setItemCat] = useState(initialCategories[0]?.id || "");

  const sortedCats = useMemo(
    () => [...categories].sort((a, b) => a.sort - b.sort),
    [categories],
  );

  async function refresh() {
    const res = await fetch(`/api/projects/${projectId}/menu`);
    const data = await res.json();
    setCategories(data.categories);
    setItems(data.items);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl">Редактор · {projectName}</h1>
          <p className="text-sm text-[var(--stone)]">Черновик → публикация</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/m/${slug}`} target="_blank">
            <Button variant="ghost">Предпросмотр</Button>
          </Link>
          <Button
            onClick={async () => {
              const res = await fetch(`/api/projects/${projectId}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note: "publish from editor" }),
              });
              setMsg(res.ok ? "Опубликовано" : "Ошибка публикации");
              await refresh();
            }}
          >
            Опубликовать
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
        <h2 className="font-semibold">Категория</h2>
        <div className="flex gap-2">
          <Input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Название (RU)"
          />
          <Button
            onClick={async () => {
              if (!catName.trim()) return;
              await fetch(`/api/projects/${projectId}/menu`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "category",
                  data: { name: { ru: catName.trim() } },
                }),
              });
              setCatName("");
              await refresh();
            }}
          >
            +
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
        <h2 className="font-semibold">Позиция</h2>
        <select
          value={itemCat}
          onChange={(e) => setItemCat(e.target.value)}
          className="min-h-11 rounded-[14px] border border-[var(--ink)]/12 px-4"
        >
          {sortedCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name.ru}
            </option>
          ))}
        </select>
        <Input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="Название (RU)"
        />
        <Input
          value={itemPrice}
          onChange={(e) => setItemPrice(e.target.value)}
          type="number"
          placeholder="Цена ₸"
        />
        <Button
          onClick={async () => {
            if (!itemName.trim() || !itemCat) return;
            await fetch(`/api/projects/${projectId}/menu`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "item",
                data: {
                  categoryId: itemCat,
                  name: { ru: itemName.trim() },
                  price: Math.max(0, Math.round(Number(itemPrice) || 0)),
                },
              }),
            });
            setItemName("");
            await refresh();
          }}
        >
          Добавить блюдо
        </Button>
      </div>

      {sortedCats.map((cat) => (
        <section key={cat.id} className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">{cat.name.ru}</h3>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await fetch(`/api/projects/${projectId}/menu`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "reorder",
                      items: [
                        { id: cat.id, kind: "category", sort: Math.max(0, cat.sort - 1) },
                      ],
                    }),
                  });
                  await refresh();
                }}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await fetch(`/api/projects/${projectId}/menu`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "reorder",
                      items: [{ id: cat.id, kind: "category", sort: cat.sort + 1 }],
                    }),
                  });
                  await refresh();
                }}
              >
                ↓
              </Button>
            </div>
          </div>
          <ul className="space-y-2">
            {items
              .filter((i) => i.categoryId === cat.id)
              .sort((a, b) => a.sort - b.sort)
              .map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-[var(--cream)] px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{item.name.ru}</div>
                    <div className="text-xs text-[var(--stone)]">
                      {item.price.toLocaleString("ru-KZ")} ₸
                      {!item.available ? " · стоп" : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await fetch(`/api/projects/${projectId}/stoplist`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          itemId: item.id,
                          available: !item.available,
                        }),
                      });
                      await refresh();
                    }}
                  >
                    {item.available ? "Стоп" : "Есть"}
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4">
        <h2 className="font-semibold mb-2">Версии</h2>
        <ul className="space-y-2 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2">
              <span>
                {new Date(v.createdAt).toLocaleString("ru-KZ")}{" "}
                {v.note ? `· ${v.note}` : ""}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await fetch(`/api/projects/${projectId}/publish`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rollbackVersionId: v.id }),
                  });
                  setMsg("Откат выполнен");
                  await refresh();
                }}
              >
                Откатить
              </Button>
            </li>
          ))}
          {!versions.length && (
            <li className="text-[var(--stone)]">Публикаций ещё не было</li>
          )}
        </ul>
      </section>

      <p className="text-xs text-[var(--stone)]">
        CSV/JSON импорт: шаблон в <code>seed/templates/menu-import.csv</code>. Полный
        импорт из PDF/фото — Фаза 2.
      </p>
      {msg && <p className="text-sm text-[var(--leaf)]">{msg}</p>}
    </div>
  );
}
