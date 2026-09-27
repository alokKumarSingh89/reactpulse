import Link from "next/link";
import { ExternalLink, Globe2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Card } from "@/components/ui/card";

import { EnvironmentActions } from "./environment-actions";

import type { Environment } from "./environment.types";
import { RunScanButton } from "../scans/run-scan-button";

interface EnvironmentCardProps {
  organizationId: string;
  projectId: string;

  environment: Environment;
  selected?: boolean;
}

export function EnvironmentCard({
  organizationId,
  projectId,
  environment,
  selected = false,
}: EnvironmentCardProps) {
  return (
    <Card
      className={`rounded-lg p-4 shadow-none ${selected ? "border-blue-200" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Globe2 size={18} />
          </div>

          <div className="min-w-0">
            <h3 className="font-medium text-slate-950">{environment.name}</h3>

            <a
              href={environment.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex max-w-md items-center gap-1 text-sm text-slate-500 hover:text-slate-950"
            >
              <span className="truncate">{safeHostname(environment.url)}</span>

              <ExternalLink size={13} className="shrink-0" />
            </a>
          </div>
        </div>

        <Badge>
          {selected ? "Selected · " : ""}
          {formatEnvironmentType(environment.type)}
        </Badge>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 items-center justify-between border-t border-slate-100 pt-4">
        <RunScanButton
          organizationId={organizationId}
          projectId={projectId}
          environmentId={environment.id}
        />

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/projects/${projectId}?environmentId=${encodeURIComponent(environment.id)}`}
            className="text-xs font-medium text-blue-700"
          >
            Select environment →
          </Link>
          <details className="relative text-xs text-slate-500">
            <summary className="cursor-pointer rounded">Manage</summary>
            <div className="absolute right-0 z-10 mt-2 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
              <EnvironmentActions
                organizationId={organizationId}
                projectId={projectId}
                environment={environment}
              />
            </div>
          </details>
        </div>
      </div>
    </Card>
  );
}

function formatEnvironmentType(type: Environment["type"]) {
  return type.toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "Hostname unavailable";
  }
}
