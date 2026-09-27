"use client";
import {
  Accessibility,
  Activity,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Menu,
  Network,
  ScanSearch,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
const navigation = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Scans", href: "/scans", icon: ScanSearch },
  { label: "Performance", href: "/performance", icon: Gauge },
  { label: "Network", href: "/network", icon: Network },
  { label: "Security", href: "/security", icon: ShieldCheck },
  { label: "Accessibility", href: "/accessibility", icon: Accessibility },
  { label: "Findings", href: "/findings", icon: ListChecks },
  { label: "Settings", href: "/settings", icon: Settings },
];
export function AppSidebar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const scanId = params.get("scanId");
  return (
    <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
        <Link
          href="/overview"
          className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-950"
        >
          <Activity size={23} className="text-blue-600" aria-hidden="true" />
          React<span className="-ml-2 text-blue-600">Pulse</span>
        </Link>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="dashboard-navigation"
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-slate-600 lg:hidden"
        >
          <Menu size={20} />
        </button>
      </div>
      <nav
        id="dashboard-navigation"
        aria-label="Main navigation"
        className={cn("space-y-1 p-3 lg:block", !open && "hidden")}
      >
        <p className="px-3 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Workspace
        </p>
        {navigation.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const query = new URLSearchParams();
          if (scanId && !["/projects", "/settings"].includes(href))
            query.set("scanId", scanId);
          if (href === "/overview")
            for (const key of ["projectId", "environmentId"]) {
              const value = params.get(key);
              if (value) query.set(key, value);
            }
          return (
            <Link
              key={href}
              href={`${href}${query.size ? `?${query}` : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
              )}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="absolute bottom-6 hidden px-6 text-xs text-slate-500 lg:block">
        Application intelligence
      </p>
    </aside>
  );
}
