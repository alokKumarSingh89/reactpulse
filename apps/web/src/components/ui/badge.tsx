import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "warning" | "danger";
}

export function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",

        variant === "neutral" && "bg-slate-100 text-slate-700",

        variant === "success" && "bg-emerald-50 text-emerald-700",

        variant === "warning" && "bg-amber-50 text-amber-700",

        variant === "danger" && "bg-red-50 text-red-700",

        className,
      )}
      {...props}
    />
  );
}
