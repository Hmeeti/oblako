import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "coral";
  size?: "md" | "lg" | "sm";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[14px] font-medium transition-[transform,opacity] duration-200 ease-[cubic-bezier(.22,.8,.2,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--leaf)] disabled:opacity-50 active:scale-[0.98] min-h-11 min-w-11",
        size === "lg" && "h-12 px-6 text-base",
        size === "md" && "h-11 px-5 text-sm",
        size === "sm" && "h-9 px-3 text-sm",
        variant === "primary" &&
          "bg-[var(--lime)] text-[var(--ink)] hover:brightness-95",
        variant === "secondary" &&
          "bg-[var(--ink)] text-[var(--cream)] hover:opacity-90",
        variant === "ghost" &&
          "bg-transparent text-[var(--ink)] border border-[color-mix(in_oklab,var(--ink)_15%,transparent)]",
        variant === "coral" && "bg-[var(--coral)] text-white",
        className,
      )}
      {...props}
    />
  );
}
