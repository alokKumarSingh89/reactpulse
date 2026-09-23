import { Bell, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { CurrentUser } from "@/features/auth/auth.types";
import { LogoutButton } from "@/features/auth/logout-button";

interface AppHeaderProps {
  user: CurrentUser;
}

export function AppHeader({ user }: AppHeaderProps) {
  const membership = user.memberships[0];

  const initials = getInitials(user.name ?? user.email);

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <div className="text-xs text-slate-500">Organization</div>

        <button className="flex items-center gap-1 text-sm font-medium text-slate-900">
          {membership?.organization.name ?? "No organization"}

          <ChevronDown size={15} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" aria-label="Notifications">
          <Bell size={18} />
        </Button>

        <div className="h-7 w-px bg-slate-200" />

        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {initials}
          </div>

          <div className="text-left">
            <div className="text-sm font-medium text-slate-900">
              {user.name ?? user.email}
            </div>

            <div className="text-xs text-slate-500">
              {membership?.role ?? "Member"}
            </div>
            <div className="text-xs">
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function getInitials(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return "U";
  }

  const parts = normalized.split(/\s+/);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return normalized.slice(0, 2).toUpperCase();
}
