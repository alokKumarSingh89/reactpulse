import { redirect } from "next/navigation";

import { getCurrentUser } from "@/features/auth/get-current-user";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/overview");
}
