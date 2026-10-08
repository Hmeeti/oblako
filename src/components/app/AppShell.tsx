"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app/leads", label: "Заявки" },
  { href: "/app/projects", label: "Проекты" },
  { href: "/app", label: "Меню" },
  { href: "/app/more", label: "Ещё" },
];

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-[100dvh] bg-[var(--cream)] pb-24">
      <header className="sticky top-0 z-20 border-b border-[var(--ink)]/10 bg-[var(--cream)]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon.svg" alt="" width={28} height={28} />
            <div>
              <div className="font-display text-lg leading-none">{brand.name}</div>
              {title && <div className="text-xs text-[var(--stone)]">{title}</div>}
            </div>
          </div>
          <button
            type="button"
            className="text-sm text-[var(--stone)] min-h-11"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Выйти
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ink)]/10 bg-[var(--cream)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-5xl grid-cols-4">
          {NAV.map((item) => {
            const active =
              item.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-14 items-center justify-center text-sm",
                    active ? "text-[var(--leaf)] font-semibold" : "text-[var(--stone)]",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
