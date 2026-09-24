"use client";

import type { FormEvent } from "react";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

interface CreateProjectFormProps {
  organizationId: string;

  onSuccess?: () => void;
}

export function CreateProjectForm({
  organizationId,
  onSuccess,
}: CreateProjectFormProps) {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    const body = {
      name: String(formData.get("name") ?? "").trim(),

      slug: String(formData.get("slug") ?? "")
        .trim()
        .toLowerCase(),
    };

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/projects`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(body),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        setError(
          typeof payload.message === "string"
            ? payload.message
            : "Unable to create project",
        );

        return;
      }

      onSuccess?.();

      router.push(`/projects/${payload.id}`);

      router.refresh();
    } catch {
      setError("Unable to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Project name
        </label>

        <Input
          id="name"
          name="name"
          placeholder="Customer Portal"
          required
          minLength={2}
          maxLength={100}
        />
      </div>

      <div>
        <label
          htmlFor="slug"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Project slug
        </label>

        <Input
          id="slug"
          name="slug"
          placeholder="customer-portal"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
          minLength={2}
          maxLength={60}
        />

        <p className="mt-2 text-xs text-slate-500">
          Lowercase letters, numbers and hyphens. The slug cannot be changed
          later.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create project"}
        </Button>
      </div>
    </form>
  );
}
