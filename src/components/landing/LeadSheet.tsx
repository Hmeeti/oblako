"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand } from "@/config/brand";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function LeadSheet({ open, onClose }: Props) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(formData: FormData) {
    setError(null);
    const payload = {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      contactMethod: String(formData.get("contactMethod") || "whatsapp"),
      venueName: String(formData.get("venueName") || "") || undefined,
      venueType: String(formData.get("venueType") || "") || undefined,
      city: String(formData.get("city") || "") || undefined,
      message: String(formData.get("message") || "") || undefined,
      website: String(formData.get("website") || ""),
      consent: formData.get("consent") === "on",
    };
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError("Не удалось отправить. Проверьте поля и попробуйте снова.");
      return;
    }
    setDone(true);
  }

  const wa =
    brand.contacts.whatsapp !== "TODO"
      ? `https://wa.me/${brand.contacts.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Здравствуйте! Хочу электронное меню Stolio.")}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button
        className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_45%,transparent)]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-title"
        className="relative z-10 w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] bg-[var(--cream)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl max-h-[92dvh] overflow-y-auto"
      >
        {done ? (
          <div className="space-y-4 py-4">
            <h2 id="lead-title" className="font-display text-2xl text-[var(--ink)]">
              Заявка принята
            </h2>
            <p className="text-[var(--stone)]">
              Мы свяжемся с вами в ближайшее время.
            </p>
            <div className="flex flex-col gap-2">
              {wa && (
                <a href={wa} className="w-full">
                  <Button className="w-full" type="button">
                    Написать в WhatsApp
                  </Button>
                </a>
              )}
              {brand.contacts.phone !== "TODO" && (
                <a href={`tel:${brand.contacts.phone}`}>
                  <Button variant="ghost" className="w-full" type="button">
                    Позвонить
                  </Button>
                </a>
              )}
              <Button variant="secondary" className="w-full" onClick={onClose}>
                Закрыть
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(() => {
                void submit(fd);
              });
            }}
          >
            <h2 id="lead-title" className="font-display text-2xl text-[var(--ink)]">
              Оставить заявку
            </h2>
            <p className="text-sm text-[var(--stone)]">
              Ответим в удобном для вас мессенджере.
            </p>
            <label className="block space-y-1 text-sm">
              <span>Имя *</span>
              <Input name="name" required autoComplete="name" />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Телефон *</span>
              <Input
                name="phone"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 (___) ___-__-__"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Способ связи *</span>
              <select
                name="contactMethod"
                className="w-full min-h-11 rounded-[14px] border border-[color-mix(in_oklab,var(--ink)_12%,transparent)] bg-white px-4"
                defaultValue="whatsapp"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="call">Звонок</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span>Название заведения</span>
              <Input name="venueName" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-sm">
                <span>Тип</span>
                <Input name="venueType" placeholder="кафе / бар" />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Город</span>
                <Input name="city" placeholder="Алматы" />
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              <span>Сообщение</span>
              <textarea
                name="message"
                rows={3}
                className="w-full rounded-[14px] border border-[color-mix(in_oklab,var(--ink)_12%,transparent)] bg-white px-4 py-3 text-base"
              />
            </label>
            {/* honeypot */}
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden
            />
            <label className="flex items-start gap-2 text-sm text-[var(--stone)]">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-1 size-4"
              />
              <span>
                Согласен на обработку персональных данных.{" "}
                <a href="/privacy" className="underline text-[var(--leaf)]">
                  Политика
                </a>
              </span>
            </label>
            {error && <p className="text-sm text-[var(--coral)]">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending} size="lg">
              {pending ? "Отправляем…" : "Отправить"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
