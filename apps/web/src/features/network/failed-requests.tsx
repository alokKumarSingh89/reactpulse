import { TriangleAlert } from "lucide-react";

import { formatResourceType } from "./network-format";

import type { NetworkFailureEvidence } from "./network.types";

interface FailedRequestsProps {
  failures: NetworkFailureEvidence[];
}

export function FailedRequests({ failures }: FailedRequestsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-2">
          <TriangleAlert size={18} className="text-slate-500" />

          <h2 className="font-semibold text-slate-950">Failed requests</h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Requests that failed before receiving a normal browser response.
        </p>
      </div>

      {failures.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          No request failures were observed.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {failures.map((failure) => (
            <div
              key={`${failure.requestSequence}-${failure.sequence}`}
              className="p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                  {failure.method}
                </span>

                <span className="text-xs text-slate-500">
                  {formatResourceType(failure.resourceType)}
                </span>

                <span className="text-xs text-slate-400">
                  {failure.domain ?? "Unknown domain"}
                </span>
              </div>

              <p
                title={failure.url}
                className="mt-3 break-all text-sm font-medium text-slate-900"
              >
                {failure.url}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {failure.failureText ??
                  "The browser did not provide a failure reason."}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
