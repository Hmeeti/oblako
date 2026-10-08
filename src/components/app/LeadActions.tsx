"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LeadActions({
  leadId,
  status,
  phone,
}: {
  leadId: string;
  status: string;
  phone: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, "");

  return (
    <div className="space-y-3">
      <div className="text-sm text-[var(--stone)]">Статус: {status}</div>
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${phone}`}>
          <Button variant="ghost">Позвонить</Button>
        </a>
        <a href={`https://wa.me/${digits}`}>
          <Button variant="secondary">WhatsApp</Button>
        </a>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch(`/api/leads/${leadId}/convert`, {
              method: "POST",
            });
            setBusy(false);
            if (!res.ok) return;
            const data = await res.json();
            router.push(`/app/projects/${data.projectId}/menu`);
          }}
        >
          Создать проект из заявки
        </Button>
      </div>
    </div>
  );
}
