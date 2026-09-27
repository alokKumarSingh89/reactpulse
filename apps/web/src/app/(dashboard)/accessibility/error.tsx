"use client";
export default function AccessibilityError({ retry }: { retry: () => void }) {
  return (
    <section
      role="alert"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h1 className="text-xl font-semibold">
        Accessibility report unavailable
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        We couldn’t load accessibility analysis for this scan.
      </p>
      <button
        onClick={retry}
        className="mt-4 rounded text-sm font-medium text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        Try again
      </button>
    </section>
  );
}
