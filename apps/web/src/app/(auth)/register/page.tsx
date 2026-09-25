import type { ReactNode } from "react";
import { Activity, CheckCircle2 } from "lucide-react";

import Link from "next/link";

import { Card } from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/register-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen bg-slate-50">
      <section className="hidden flex-1 bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white text-slate-950">
            <Activity size={21} />
          </div>

          <div>
            <div className="font-semibold">ReactPulse</div>

            <div className="text-xs text-slate-400">
              Application Intelligence
            </div>
          </div>
        </div>

        <div className="max-w-xl">
          <h1 className="text-4xl font-semibold tracking-tight">
            Build faster applications with evidence, not guesses.
          </h1>

          <p className="mt-5 max-w-lg leading-7 text-slate-400">
            Create your workspace and start measuring performance, regressions,
            security and application quality.
          </p>

          <div className="mt-8 space-y-4">
            <Feature>Synthetic browser performance analysis</Feature>

            <Feature>Network and resource intelligence</Feature>

            <Feature>Security and accessibility analysis</Feature>

            <Feature>Evidence-backed engineering recommendations</Feature>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          ReactPulse Application Intelligence
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center p-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="text-xl font-semibold text-slate-950">
              ReactPulse
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Application Intelligence
            </div>
          </div>

          <Card className="p-7">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Create your workspace
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Start analyzing your web applications with ReactPulse.
              </p>
            </div>

            <RegisterForm />

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-slate-950 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </Card>

          <p className="mt-5 text-center text-xs leading-5 text-slate-400">
            By creating an account, you agree to the applicable ReactPulse terms
            and privacy policy.
          </p>
        </div>
      </section>
    </main>
  );
}

function Feature({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-300">
      <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />

      <span>{children}</span>
    </div>
  );
}
