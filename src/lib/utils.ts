import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function deviceClassFromUa(ua: string | null): string {
  if (!ua) return "unknown";
  const lower = ua.toLowerCase();
  if (/ipad|tablet/.test(lower)) return "tablet";
  if (/mobi|iphone|android/.test(lower)) return "mobile";
  return "desktop";
}
