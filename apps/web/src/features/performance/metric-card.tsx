import { Card } from "@/components/ui/card";

interface MetricCardProps {
  label: string;

  value: string;

  description?: string;
}

export function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <Card className="p-5">
      <div className="text-sm font-medium text-slate-500">{label}</div>

      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      {description && (
        <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
      )}
    </Card>
  );
}
