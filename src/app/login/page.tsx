"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand } from "@/config/brand";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="min-h-[100dvh] grid place-items-center px-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-[24px] border border-[var(--ink)]/10 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const fd = new FormData(e.currentTarget);
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: fd.get("email"),
              password: fd.get("password"),
            }),
          });
          setPending(false);
          if (!res.ok) {
            setError("Неверный email или пароль");
            return;
          }
          router.push("/app");
        }}
      >
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon.svg" alt="" width={32} height={32} />
          <h1 className="font-display text-2xl">{brand.name}</h1>
        </div>
        <p className="text-sm text-[var(--stone)]">Вход в кабинет студии</p>
        <label className="block space-y-1 text-sm">
          <span>Email</span>
          <Input name="email" type="email" required autoComplete="username" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Пароль</span>
          <Input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-[var(--coral)]">{error}</p>}
        <Button className="w-full" disabled={pending}>
          {pending ? "Входим…" : "Войти"}
        </Button>
      </form>
    </div>
  );
}
