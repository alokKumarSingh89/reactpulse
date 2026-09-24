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
}

export function EnvironmentCard({
  organizationId,
  projectId,
  environment,
}: EnvironmentCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
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
              <span className="truncate">{environment.url}</span>

              <ExternalLink size={13} className="shrink-0" />
            </a>
          </div>
        </div>

        <Badge>{formatEnvironmentType(environment.type)}</Badge>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <RunScanButton
          organizationId={organizationId}
          projectId={projectId}
          environmentId={environment.id}
        />

        <EnvironmentActions
          organizationId={organizationId}
          projectId={projectId}
          environment={environment}
        />
      </div>
    </Card>
  );
}

function formatEnvironmentType(type: Environment["type"]) {
  return type.toLowerCase().replace(/^./, (value) => value.toUpperCase());
}
