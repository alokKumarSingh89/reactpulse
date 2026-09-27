import { ChevronDown } from "lucide-react";
import { Suspense } from "react";
import type { CurrentUser } from "@/features/auth/auth.types";
import { LogoutButton } from "@/features/auth/logout-button";
import { getOverviewContext } from "@/features/overview/overview-data";
import { ContextSelectors } from "./context-selectors";

export async function AppHeader({ user }: { user: CurrentUser }) {
  const membership = user.memberships[0];
  const context = membership
    ? await getOverviewContext(membership.organization.id)
    : null;
  const initials = (user.name ?? user.email).trim().slice(0, 2).toUpperCase();
  return (
    <header className="flex min-h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      {context && membership ? (
        <Suspense
          fallback={
            <span className="text-xs text-slate-500">Loading context…</span>
          }
        >
          <ContextSelectors
            organizationId={membership.organization.id}
            projects={context.projects}
            scans={context.scans}
            unavailable={context.projectsUnavailable}
          />
        </Suspense>
      ) : (
        <span className="text-sm text-slate-500">No organization</span>
      )}
      <details className="relative shrink-0">
        <summary
          className="flex cursor-pointer list-none items-center gap-2 rounded-md p-1 text-sm"
          aria-label="Account menu"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden max-w-32 truncate text-slate-700 xl:block">
            {user.name ?? user.email}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="absolute right-0 z-30 mt-3 w-60 max-w-[80vw] rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="break-words text-sm font-medium">
            {user.name ?? user.email}
          </p>
          <p className="mt-1 break-words text-xs text-slate-500">
            {membership?.organization.name} · {membership?.role ?? "Member"}
          </p>
          <div className="mt-3 border-t border-slate-100 pt-2">
            <LogoutButton />
          </div>
        </div>
      </details>
    </header>
  );
}
