export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  if (value < 1024) {
    return `${Math.round(value)} B`;
  }

  const kilobytes = value / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  const megabytes = kilobytes / 1024;

  return `${megabytes.toFixed(2)} MB`;
}

export function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return Math.round(value).toLocaleString();
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(1)}%`;
}

export function formatResourceType(value: string): string {
  switch (value) {
    case "xhr":
      return "XHR";

    case "fetch":
      return "Fetch";

    case "script":
      return "JavaScript";

    case "stylesheet":
      return "CSS";

    case "image":
      return "Image";

    case "font":
      return "Font";

    case "document":
      return "Document";

    default:
      return capitalize(value);
  }
}

function capitalize(value: string): string {
  if (!value) {
    return "Other";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}
