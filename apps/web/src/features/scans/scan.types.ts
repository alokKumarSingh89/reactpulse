export type ScanStatus =
  "PENDING" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type ScanTrigger =
  "MANUAL" | "SCHEDULED" | "API" | "CI" | "PULL_REQUEST";

export type DeviceType = "DESKTOP" | "MOBILE";

export type MetricCategory =
  | "PERFORMANCE"
  | "NETWORK"
  | "RESOURCE"
  | "BUNDLE"
  | "REACT"
  | "ACCESSIBILITY"
  | "SECURITY"
  | "MEMORY";

export interface ScanMetric {
  id: string;

  category: MetricCategory;

  key: string;

  value: number;

  unit: string | null;

  metadata: Record<string, unknown> | null;
}

export interface ScanProject {
  id: string;
  name: string;
  slug: string;
}

export interface ScanEnvironment {
  id: string;
  name: string;

  type: "PRODUCTION" | "STAGING" | "PREVIEW" | "DEVELOPMENT" | "OTHER";

  project: ScanProject;
}

export interface ScanSummary {
  id: string;

  status: ScanStatus;

  trigger: ScanTrigger;

  targetUrl: string;

  deviceType: DeviceType;

  browserName: string | null;

  browserVersion: string | null;

  startedAt: string | null;

  completedAt: string | null;

  failureCode: string | null;

  failureMessage: string | null;

  createdAt: string;
  updatedAt: string;

  environment: ScanEnvironment;
}

export interface ScanDetail extends ScanSummary {
  metrics: ScanMetric[];
}
