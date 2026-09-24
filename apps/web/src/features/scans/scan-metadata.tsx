import type { ScanDetail } from "./scan.types";

interface ScanMetadataProps {
  scan: ScanDetail;
}

export function ScanMetadata({ scan }: ScanMetadataProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-950">Scan details</h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetadataItem label="Device" value={formatEnum(scan.deviceType)} />

        <MetadataItem label="Trigger" value={formatEnum(scan.trigger)} />

        <MetadataItem label="Browser" value={getBrowserLabel(scan)} />

        <MetadataItem label="Created" value={formatDate(scan.createdAt)} />

        <MetadataItem
          label="Started"
          value={scan.startedAt ? formatDate(scan.startedAt) : "—"}
        />

        <MetadataItem
          label="Completed"
          value={scan.completedAt ? formatDate(scan.completedAt) : "—"}
        />

        <div className="sm:col-span-2">
          <MetadataItem label="Target" value={scan.targetUrl} allowWrap />
        </div>
      </div>
    </section>
  );
}

function MetadataItem({
  label,
  value,
  allowWrap = false,
}: {
  label: string;
  value: string;
  allowWrap?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div
        className={`mt-1 text-sm font-medium text-slate-800 ${
          allowWrap ? "break-all" : "truncate"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function getBrowserLabel(scan: ScanDetail): string {
  if (!scan.browserName) {
    return "—";
  }

  if (!scan.browserVersion) {
    return scan.browserName;
  }

  return `${scan.browserName} ${scan.browserVersion}`;
}

function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",

    timeStyle: "medium",
  }).format(date);
}
