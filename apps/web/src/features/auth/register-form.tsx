"use client";

import type { FormEvent } from "react";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const body = {
      name: String(formData.get("name") ?? "").trim(),

      email: String(formData.get("email") ?? "").trim(),

      password: String(formData.get("password") ?? ""),

      organizationName: String(formData.get("organizationName") ?? "").trim(),

      organizationSlug: String(formData.get("organizationSlug") ?? "")
        .trim()
        .toLowerCase(),
    };

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(
          typeof payload.message === "string"
            ? payload.message
            : "Unable to create account",
        );

        return;
      }

      router.replace("/overview");

      router.refresh();
    } catch {
      setError("Unable to connect to ReactPulse");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
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
          Your name
        </label>

        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Alok Singh"
          autoComplete="name"
          required
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Work email
        </label>

        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Password
        </label>

        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Minimum 12 characters"
          autoComplete="new-password"
          minLength={12}
          required
        />

        <p className="mt-2 text-xs text-slate-500">
          Use at least 12 characters.
        </p>
      </div>

      <div>
        <label
          htmlFor="organizationName"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Organization name
        </label>

        <Input
          id="organizationName"
          name="organizationName"
          type="text"
          placeholder="Acme Engineering"
          autoComplete="organization"
          required
        />
      </div>

      <div>
        <label
          htmlFor="organizationSlug"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Workspace slug
        </label>

        <Input
          id="organizationSlug"
          name="organizationSlug"
          type="text"
          placeholder="acme-engineering"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />

        <p className="mt-2 text-xs text-slate-500">
          Lowercase letters, numbers and hyphens.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating workspace..." : "Create workspace"}
      </Button>
    </form>
  );
}
