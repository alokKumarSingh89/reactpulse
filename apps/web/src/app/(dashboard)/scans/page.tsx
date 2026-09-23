import { ScanSearch } from "lucide-react";

export default function ScansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Scans
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Inspect synthetic application scans and their execution status.
        </p>
      </div>

      <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <ScanSearch size={22} />
        </div>

        <h2 className="mt-4 font-semibold text-slate-950">No scans yet</h2>

        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          Once you create a project and environment, you&apos;ll be able to
          launch browser scans from here.
        </p>
      </div>
    </div>
  );
}
