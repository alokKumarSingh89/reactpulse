import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/features/auth/get-current-user";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/overview");
  }

  return children;
}
