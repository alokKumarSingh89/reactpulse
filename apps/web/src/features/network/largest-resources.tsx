import {
  formatBytes,
  formatDuration,
  formatResourceType,
} from "./network-format";

import type { NetworkResponseEvidence } from "./network.types";

interface LargestResourcesProps {
  responses: NetworkResponseEvidence[];
}

export function LargestResources({ responses }: LargestResourcesProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <h2 className="font-semibold text-slate-950">Largest resources</h2>

        <p className="mt-1 text-sm text-slate-500">
          Largest measured responses observed during the scan.
        </p>
      </div>

      {responses.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          Transfer-size evidence was not available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Resource</th>

                <th className="px-5 py-3 font-medium">Type</th>

                <th className="px-5 py-3 text-right font-medium">Size</th>

                <th className="px-5 py-3 text-right font-medium">Duration</th>
              </tr>
            </thead>

            <tbody>
              {responses.map((response) => (
                <tr
                  key={`${response.requestSequence}-${response.sequence}`}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className="max-w-md px-5 py-4">
                    <p
                      title={response.url}
                      className="truncate font-medium text-slate-900"
                    >
                      {displayUrl(response.url)}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {response.domain ?? "Unknown domain"}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {formatResourceType(response.resourceType)}
                  </td>

                  <td className="px-5 py-4 text-right text-slate-600">
                    {formatBytes(response.transferSize)}
                  </td>

                  <td className="px-5 py-4 text-right text-slate-600">
                    {formatDuration(response.durationMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function displayUrl(value: string): string {
  try {
    const url = new URL(value);

    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}
