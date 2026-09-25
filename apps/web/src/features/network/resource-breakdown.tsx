import { formatBytes, formatResourceType } from "./network-format";

import type { NetworkViewModel } from "./network-view-model";

interface ResourceBreakdownProps {
  model: NetworkViewModel;
}

export function ResourceBreakdown({ model }: ResourceBreakdownProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <h2 className="font-semibold text-slate-950">Resource breakdown</h2>

        <p className="mt-1 text-sm text-slate-500">
          Requests and measured transfer size by browser resource type.
        </p>
      </div>

      {model.resourceBreakdown.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          No resource evidence was recorded for this scan.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Type</th>

                <th className="px-5 py-3 text-right font-medium">Requests</th>

                <th className="px-5 py-3 text-right font-medium">Transfer</th>
              </tr>
            </thead>

            <tbody>
              {model.resourceBreakdown.map((item) => (
                <tr
                  key={item.type}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {formatResourceType(item.type)}
                  </td>

                  <td className="px-5 py-4 text-right text-slate-600">
                    {item.requests}
                  </td>

                  <td className="px-5 py-4 text-right text-slate-600">
                    {formatBytes(item.transferSize)}
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
