"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProjectSettingsForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: {
    name: string;
    status: string;
    themeId: string;
    serviceChargePercent: number;
  };
}) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 rounded-2xl border border-[var(--ink)]/10 bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fd.get("name"),
            status: fd.get("status"),
            themeId: fd.get("themeId"),
            serviceChargePercent: Number(fd.get("serviceChargePercent")),
          }),
        });
        setMsg(res.ok ? "Сохранено" : "Ошибка сохранения");
      }}
    >
      <h2 className="font-semibold">Настройки</h2>
      <label className="block text-sm space-y-1">
        <span>Название</span>
        <Input name="name" defaultValue={initial.name} />
      </label>
      <label className="block text-sm space-y-1">
        <span>Статус</span>
        <select
          name="status"
          defaultValue={initial.status}
          className="w-full min-h-11 rounded-[14px] border border-[var(--ink)]/12 bg-white px-4"
        >
          <option value="draft">draft</option>
          <option value="live">live</option>
          <option value="paused">paused</option>
        </select>
      </label>
      <label className="block text-sm space-y-1">
        <span>Тема</span>
        <select
          name="themeId"
          defaultValue={initial.themeId}
          className="w-full min-h-11 rounded-[14px] border border-[var(--ink)]/12 bg-white px-4"
        >
          <option value="classic-green">Classic Green & Beige</option>
          <option value="dark-bar">Dark Bar</option>
          <option value="minimal-light">Minimal Light</option>
        </select>
      </label>
      <label className="block text-sm space-y-1">
        <span>Обслуживание %</span>
        <Input
          name="serviceChargePercent"
          type="number"
          defaultValue={initial.serviceChargePercent}
        />
      </label>
      <Button type="submit">Сохранить</Button>
      {msg && <p className="text-sm text-[var(--stone)]">{msg}</p>}
    </form>
  );
}
