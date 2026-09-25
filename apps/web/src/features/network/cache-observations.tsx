import { Database, ServerCog } from "lucide-react";

import { formatResourceType } from "./network-format";

import type { NetworkViewModel } from "./network-view-model";

interface CacheObservationsProps {
  model: NetworkViewModel;
}

export function CacheObservations({ model }: CacheObservationsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-slate-500" />

          <h2 className="font-semibold text-slate-950">Cache observations</h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Browser-visible cache policy and service-worker observations. These do
          not necessarily indicate a browser cache hit.
        </p>
      </div>

      <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-3">
        <Summary
          label="Cache-Control"
          value={model.cacheControlResponseCount}
          description="Responses exposing a Cache-Control header"
        />

        <Summary
          label="No Cache-Control"
          value={model.missingCacheControlResponseCount}
          description="Responses without an observed Cache-Control header"
        />

        <Summary
          label="Service worker"
          value={model.serviceWorkerResponseCount}
          description="Responses reported by Chromium as service-worker responses"
        />
      </div>

      {model.cacheObservations.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          No cache-policy or service-worker observations were recorded.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {model.cacheObservations.map((observation, index) => (
            <div key={`${observation.url}-${index}`} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                  {formatResourceType(observation.resourceType)}
                </span>

                {observation.fromServiceWorker && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    <ServerCog size={12} />
                    Service worker
                  </span>
                )}
              </div>

              <p
                title={observation.url}
                className="mt-3 truncate text-sm font-medium text-slate-900"
              >
                {observation.domain ?? observation.url}
              </p>

              <p className="mt-2 break-all font-mono text-xs text-slate-500">
                Cache-Control: {observation.cacheControl ?? "not observed"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

interface SummaryProps {
  label: string;
  value: number;
  description: string;
}

function Summary({ label, value, description }: SummaryProps) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>

      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
