import type { ReactNode } from "react";

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
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} />

        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1600px] p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
