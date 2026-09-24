"use client";

import { Trash2 } from "lucide-react";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import type { Environment } from "./environment.types";

interface EnvironmentActionsProps {
  organizationId: string;
  projectId: string;

  environment: Environment;
}

export function EnvironmentActions({
  organizationId,
  projectId,
  environment,
}: EnvironmentActionsProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function remove() {
    const confirmed = window.confirm(
      `Delete "${environment.name}"? Existing scan history associated with this environment may also be deleted.`,
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/projects/${projectId}/environments/${environment.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const payload = await response.json();

        window.alert(payload.message ?? "Unable to delete environment");

        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" disabled={loading} onClick={remove}>
      <Trash2 size={15} />

      <span className="ml-2">Delete</span>
    </Button>
  );
}
