import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Settings
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage workspace and ReactPulse configuration.
        </p>
      </div>

      <Card className="divide-y divide-slate-100">
        <SettingRow
          title="Organization"
          description="Organization profile and workspace configuration."
        />

        <SettingRow
          title="Members"
          description="Manage organization members and roles."
        />

        <SettingRow
          title="Scan configuration"
          description="Default browser profiles and scanning preferences."
        />

        <SettingRow
          title="Integrations"
          description="GitHub, alerts and other integrations will appear here."
        />
      </Card>
    </div>
  );
}

function SettingRow({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-5">
      <div className="font-medium text-slate-900">{title}</div>

      <div className="mt-1 text-sm text-slate-500">{description}</div>
    </div>
  );
}
