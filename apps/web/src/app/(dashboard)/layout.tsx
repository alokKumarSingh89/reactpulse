import { Suspense, type ReactNode } from "react";

import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";

import { AppSidebar } from "@/components/layout/app-sidebar";

import { getCurrentUser } from "@/features/auth/get-current-user";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <Suspense>
        <AppSidebar />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} />

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
