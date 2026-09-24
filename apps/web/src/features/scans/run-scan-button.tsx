"use client";

import { Play } from "lucide-react";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

interface RunScanButtonProps {
  organizationId: string;
  projectId: string;
  environmentId: string;
}

export function RunScanButton({
  organizationId,
  projectId,
  environmentId,
}: RunScanButtonProps) {
  const router = useRouter();

  const [running, setRunning] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function runScan() {
    setRunning(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}` +
          `/projects/${projectId}` +
          `/environments/${environmentId}` +
          "/scans",
        {
          method: "POST",
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        setError(
          typeof payload.message === "string"
            ? payload.message
            : "Unable to start scan",
        );

        return;
      }

      router.push(`/scans?scanId=${encodeURIComponent(payload.id)}`);
    } catch {
      setError("Unable to start scan");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <Button size="sm" onClick={runScan} disabled={running}>
        <Play size={15} />

        <span className="ml-2">{running ? "Starting..." : "Run scan"}</span>
      </Button>

      {error && <p className="mt-2 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
