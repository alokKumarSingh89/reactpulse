import {
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Card } from "@/components/ui/card";

const metrics = [
  {
    label: "LCP",
    value: "2.4s",
    description: "Largest Contentful Paint",
    change: "-8%",
    improved: true,
  },
  {
    label: "FCP",
    value: "1.1s",
    description: "First Contentful Paint",
    change: "-3%",
    improved: true,
  },
  {
    label: "Blocking",
    value: "184ms",
    description: "Observed blocking time",
    change: "+12%",
    improved: false,
  },
  {
    label: "Transfer",
    value: "1.8 MB",
    description: "Transferred resources",
    change: "+4%",
    improved: false,
  },
];

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Overview
          </h1>

          <Badge variant="success">Healthy</Badge>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Monitor application performance, security and quality from one
          workspace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <div className="text-sm font-medium text-slate-500">
              {metric.label}
            </div>

            <div className="mt-2 flex items-end justify-between">
              <div className="text-3xl font-semibold tracking-tight text-slate-950">
                {metric.value}
              </div>

              <div
                className={
                  metric.improved
                    ? "flex items-center gap-1 text-xs font-medium text-emerald-600"
                    : "flex items-center gap-1 text-xs font-medium text-red-600"
                }
              >
                {metric.improved ? (
                  <ArrowDownRight size={14} />
                ) : (
                  <ArrowUpRight size={14} />
                )}

                {metric.change}
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              {metric.description}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <div>
            <h2 className="font-semibold text-slate-950">Latest scan</h2>

            <p className="mt-1 text-sm text-slate-500">
              Performance summary from the most recent synthetic scan.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Summary
              icon={Gauge}
              title="Performance"
              value="Good"
              description="2 metrics need attention"
            />

            <Summary
              icon={ShieldCheck}
              title="Security"
              value="No critical"
              description="3 recommendations"
            />

            <Summary
              icon={ScanSearch}
              title="Resources"
              value="84"
              description="1.8 MB transferred"
            />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <TriangleAlert size={18} className="text-amber-600" />

            <h2 className="font-semibold text-slate-950">Needs attention</h2>
          </div>

          <div className="mt-5 space-y-4">
            <Finding
              title="JavaScript execution"
              description="Long tasks increased since the previous scan."
            />

            <Finding
              title="Transfer size"
              description="Page resources increased by approximately 4%."
            />

            <Finding
              title="Security headers"
              description="Security analysis will be enabled in a later sprint."
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Summary({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof Gauge;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <Icon size={20} className="text-slate-600" />

      <div className="mt-4 text-sm text-slate-500">{title}</div>

      <div className="mt-1 font-semibold text-slate-950">{value}</div>

      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function Finding({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div className="text-sm font-medium text-slate-900">{title}</div>

      <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
    </div>
  );
}
