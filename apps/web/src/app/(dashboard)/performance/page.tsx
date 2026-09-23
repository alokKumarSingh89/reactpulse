import { Gauge } from "lucide-react";

export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Performance
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Browser performance metrics, timings and regression analysis.
        </p>
      </div>

      <Placeholder
        title="Performance data will appear here"
        description="Run your first scan to measure TTFB, FCP, LCP, long tasks, resource size and other synthetic performance observations."
      />
    </div>
  );
}

function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <Gauge size={22} />
      </div>

      <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>

      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}
