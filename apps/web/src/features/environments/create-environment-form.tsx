"use client";

import type { FormEvent } from "react";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

interface CreateEnvironmentFormProps {
  organizationId: string;
  projectId: string;

  onSuccess?: () => void;
}

export function CreateEnvironmentForm({
  organizationId,
  projectId,
  onSuccess,
}: CreateEnvironmentFormProps) {
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

      url: String(formData.get("url") ?? "").trim(),

      type: String(formData.get("type") ?? ""),
    };

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/projects/${projectId}/environments`,
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
            : "Unable to create environment",
        );

        return;
      }

      onSuccess?.();

      router.refresh();
    } catch {
      setError("Unable to create environment");
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
          htmlFor="environment-name"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Name
        </label>

        <Input
          id="environment-name"
          name="name"
          placeholder="Production"
          required
        />
      </div>

      <div>
        <label
          htmlFor="environment-url"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Application URL
        </label>

        <Input
          id="environment-url"
          name="url"
          type="url"
          placeholder="https://example.com"
          required
        />

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Only HTTP and HTTPS targets allowed by ReactPulse security policy can
          be stored.
        </p>
      </div>

      <div>
        <label
          htmlFor="environment-type"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Environment type
        </label>

        <select
          id="environment-type"
          name="type"
          defaultValue="PRODUCTION"
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
        >
          <option value="PRODUCTION">Production</option>

          <option value="STAGING">Staging</option>

          <option value="PREVIEW">Preview</option>

          <option value="DEVELOPMENT">Development</option>

          <option value="OTHER">Other</option>
        </select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create environment"}
        </Button>
      </div>
    </form>
  );
}
