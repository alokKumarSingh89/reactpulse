"use client";

import {
  Activity,
  Brain,
  FolderKanban,
  Gauge,
  Globe2,
  LayoutDashboard,
  Network,
  ScanSearch,
  Settings,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const navigation = [
  {
    label: "Overview",
    href: "/overview",
    icon: LayoutDashboard,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    label: "Scans",
    href: "/scans",
    icon: ScanSearch,
  },
  {
    label: "Performance",
    href: "/performance",
    icon: Gauge,
  },
  {
    label: "Network",
    href: "/network",
    icon: Network,
  },
  {
    label: "Security",
    href: "/security",
    icon: ShieldCheck,
  },
  {
    label: "Accessibility",
    href: "/accessibility",
    icon: Activity,
  },
  {
    label: "AI Findings",
    href: "/findings",
    icon: Brain,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-white">
          <Globe2 size={19} />
        </div>

        <div>
          <div className="font-semibold tracking-tight text-slate-950">
            ReactPulse
          </div>

          <div className="text-xs text-slate-500">Application Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navigation.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",

                active
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
              )}
            >
              <Icon size={18} />

              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <Link
          href="/settings"
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
