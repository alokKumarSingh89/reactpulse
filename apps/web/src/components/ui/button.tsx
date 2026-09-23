import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";

  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        "disabled:pointer-events-none disabled:opacity-50",

        variant === "primary" && "bg-slate-950 text-white hover:bg-slate-800",

        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",

        variant === "ghost" &&
          "text-slate-600 hover:bg-slate-100 hover:text-slate-950",

        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",

        size === "sm" && "h-8 px-3 text-sm",

        size === "md" && "h-10 px-4 text-sm",

        size === "lg" && "h-11 px-5",

        className,
      )}
      {...props}
    />
  );
}
