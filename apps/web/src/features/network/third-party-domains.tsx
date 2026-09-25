import { Globe2 } from "lucide-react";

import { formatBytes } from "./network-format";

import type { NetworkViewModel } from "./network-view-model";

interface ThirdPartyDomainsProps {
  domains: NetworkViewModel["thirdPartyDomains"];
}

export function ThirdPartyDomains({ domains }: ThirdPartyDomainsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-2">
          <Globe2 size={18} className="text-slate-500" />

          <h2 className="font-semibold text-slate-950">Third-party domains</h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          External domains observed during this scan.
        </p>
      </div>

      {domains.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          No third-party responses were observed.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {domains.map((domain) => (
            <div
              key={domain.domain}
              className="flex items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {domain.domain}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {domain.requests}{" "}
                  {domain.requests === 1 ? "request" : "requests"}
                </p>
              </div>

              <p className="shrink-0 text-sm font-medium text-slate-700">
                {formatBytes(domain.transferSize)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
