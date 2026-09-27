export default function OverviewLoading() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <h1 className="text-3xl font-semibold">Overview</h1>
      <p className="text-sm text-slate-500">Loading scan observations…</p>
      <div aria-hidden="true" className="grid gap-5 md:grid-cols-2">
        {[0, 1, 2, 3].map((key) => (
          <div
            key={key}
            className="h-60 rounded-lg border border-slate-200 bg-white p-6"
          >
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="mt-8 h-8 w-36 rounded bg-slate-100" />
            <div className="mt-8 h-3 w-3/4 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
