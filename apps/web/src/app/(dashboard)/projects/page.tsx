import { FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage the applications monitored by ReactPulse."
      />

      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Projects will contain your applications, environments and scan history."
      />
    </div>
  );
}

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h1>

      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FolderKanban;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <Icon size={22} />
      </div>

      <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}
