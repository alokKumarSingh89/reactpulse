import { Badge } from "@/components/ui/badge";

import type { ScanStatus } from "./scan.types";

interface ScanStatusBadgeProps {
  status: ScanStatus;
}

export function ScanStatusBadge({ status }: ScanStatusBadgeProps) {
  return (
    <Badge
      variant={
        status === "COMPLETED"
          ? "success"
          : status === "FAILED"
            ? "danger"
            : ["RUNNING", "QUEUED", "PENDING"].includes(status)
              ? "warning"
              : "neutral"
      }
    >
      <span
        aria-hidden="true"
        className="mr-1.5 size-1.5 rounded-full bg-current"
      />
      {formatStatus(status)}
    </Badge>
  );
}

function formatStatus(status: ScanStatus) {
  switch (status) {
    case "PENDING":
      return "Pending";

    case "QUEUED":
      return "Queued";

    case "RUNNING":
      return "Running";

    case "COMPLETED":
      return "Completed";

    case "FAILED":
      return "Failed";

    case "CANCELLED":
      return "Cancelled";
  }
}
