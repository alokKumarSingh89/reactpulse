import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function AnalyticsSurface({
  title,
  icon: Icon,
  href,
  tone = "blue",
  children,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  tone?: "blue" | "violet" | "amber" | "slate";
  children: ReactNode;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-8 items-center justify-center rounded-md ${tones[tone]}`}
        >
          <Icon size={17} aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <ArrowUpRight
          size={17}
          aria-hidden="true"
          className="ml-auto text-slate-400 group-hover:text-blue-600"
        />
      </div>
      <div className="mt-5 flex-1">{children}</div>
    </Link>
  );
}

export function MetricMeta({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] text-slate-500">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium tabular-nums text-slate-800">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
