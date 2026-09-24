"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Archive, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Project } from "./project.types";

interface ProjectActionsProps {
  organizationId: string;
  project: Project;
}

export function ProjectActions({
  organizationId,
  project,
}: ProjectActionsProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function updateStatus() {
    setLoading(true);
    setError(null);

    const nextStatus = project.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/projects/${project.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json();

        setError(payload.message ?? "Unable to update project");

        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject() {
    const confirmed = window.confirm(
      `Delete "${project.name}" and all of its environments and scan history?`,
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/projects/${project.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const payload = await response.json();

        setError(payload.message ?? "Unable to delete project");

        return;
      }

      router.replace("/projects");

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={updateStatus}
        >
          {project.status === "ACTIVE" ? (
            <>
              <Archive size={15} />

              <span className="ml-2">Archive</span>
            </>
          ) : (
            <>
              <RotateCcw size={15} />

              <span className="ml-2">Restore</span>
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={deleteProject}
        >
          <Trash2 size={15} />

          <span className="ml-2">Delete</span>
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
