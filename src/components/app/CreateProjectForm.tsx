"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateProjectForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-[var(--ink)]/10 bg-white p-4 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const fd = new FormData(e.currentTarget);
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: fd.get("name") }),
        });
        setPending(false);
        if (!res.ok) return;
        const data = await res.json();
        router.push(`/app/projects/${data.project.id}`);
        router.refresh();
      }}
    >
      <Input name="name" placeholder="Название заведения" required />
      <Button disabled={pending}>{pending ? "…" : "Создать"}</Button>
    </form>
  );
}
