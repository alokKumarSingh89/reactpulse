"use client";

import { LogOut } from "lucide-react";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action="/api/auth/logout"
      method="POST"
      onSubmit={() => {
        setSubmitting(true);
      }}
    >
      <Button variant="ghost" size="sm" type="submit" disabled={submitting}>
        <LogOut size={16} />

        <span className="ml-2">
          {submitting ? "Signing out..." : "Sign out"}
        </span>
      </Button>
    </form>
  );
}
