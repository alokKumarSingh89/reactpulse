import {
  Activity,
  ArrowDownToLine,
  Braces,
  Globe2,
  TriangleAlert,
} from "lucide-react";

import { formatBytes, formatCount, formatPercentage } from "./network-format";

import type { NetworkViewModel } from "./network-view-model";

interface NetworkSummaryProps {
  model: NetworkViewModel;
}

export function NetworkSummary({ model }: NetworkSummaryProps) {
  const items = [
    {
      label: "Requests",

      value: formatCount(model.requestCount),

      description: "Observed browser requests",

      icon: Activity,
    },

    {
      label: "Transferred",

      value: formatBytes(model.totalTransferSize),

      description: "Measured response transfer",

      icon: ArrowDownToLine,
    },

    {
      label: "API requests",

      value: formatCount(model.apiRequestCount),

      description: "Fetch and XHR requests",

      icon: Braces,
    },

    {
      label: "Third-party",

      value: formatPercentage(model.thirdPartyPercentage),

      description: "Share of observed requests",

      icon: Globe2,
    },

    {
      label: "Failed",

      value: formatCount(model.failedRequestCount),

      description: "Browser request failures",

      icon: TriangleAlert,
    },
  ];

  return (
    <section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {item.label}
                </p>

                <Icon size={18} className="text-slate-400" />
              </div>

              <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                {item.value}
              </p>

              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
