"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Code = {
  id: string;
  code: string;
  label: string | null;
  tableNumber: number | null;
};

export function QrManager({
  projectId,
  projectName,
  initialCodes,
}: {
  projectId: string;
  projectName: string;
  initialCodes: Code[];
}) {
  const [codes, setCodes] = useState(initialCodes);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("10");

  async function refresh() {
    const res = await fetch(`/api/projects/${projectId}/qr`);
    const data = await res.json();
    setCodes(data.codes);
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">QR · {projectName}</h1>
      <div className="rounded-2xl border border-[var(--ink)]/10 bg-white p-4 space-y-3">
        <h2 className="font-semibold">Пакет для столов</h2>
        <div className="flex gap-2">
          <Input value={from} onChange={(e) => setFrom(e.target.value)} type="number" />
          <Input value={to} onChange={(e) => setTo(e.target.value)} type="number" />
          <Button
            onClick={async () => {
              await fetch(`/api/projects/${projectId}/qr`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: Number(from),
                  to: Number(to),
                }),
              });
              await refresh();
            }}
          >
            Создать
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/projects/${projectId}/qr?format=pdf`}>
            <Button variant="secondary">PDF A4</Button>
          </a>
          <a href={`/api/projects/${projectId}/qr?format=zip`}>
            <Button variant="ghost">ZIP SVG/PNG</Button>
          </a>
        </div>
      </div>
      <ul className="space-y-2">
        {codes.map((c) => (
          <li
            key={c.id}
            className="rounded-2xl border border-[var(--ink)]/10 bg-white px-4 py-3 text-sm"
          >
            <div className="font-medium">{c.label || c.code}</div>
            <div className="text-[var(--stone)]">
              /q/{c.code}
              {c.tableNumber != null ? ` · стол ${c.tableNumber}` : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
