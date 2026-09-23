import { Activity } from "lucide-react";

import Link from "next/link";

import { Card } from "@/components/ui/card";

import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
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
            Understand what made your application slower.
          </h1>

          <p className="mt-5 max-w-lg leading-7 text-slate-400">
            Measure performance, inspect runtime evidence, detect regressions
            and understand what engineering teams should investigate next.
          </p>
        </div>

        <div className="text-sm text-slate-500">
          Synthetic performance intelligence for modern web applications.
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="text-xl font-semibold text-slate-950">
              ReactPulse
            </div>
          </div>

          <Card className="p-7">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Welcome back
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Sign in to your ReactPulse workspace.
              </p>
            </div>

            <LoginForm />

            <p className="mt-6 text-center text-sm text-slate-500">
              New to ReactPulse?{" "}
              <Link
                href="/register"
                className="font-medium text-slate-950 hover:underline"
              >
                Create an account
              </Link>
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
