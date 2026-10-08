import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full min-h-11 rounded-[14px] border border-[color-mix(in_oklab,var(--ink)_12%,transparent)] bg-white px-4 text-base text-[var(--ink)] placeholder:text-[var(--stone)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--leaf)]",
        className,
      )}
      {...props}
    />
  );
}
