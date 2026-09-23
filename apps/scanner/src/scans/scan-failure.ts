export enum ScanFailureCode {
  TARGET_NOT_ALLOWED = 'TARGET_NOT_ALLOWED',

  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',

  NAVIGATION_TIMEOUT = 'NAVIGATION_TIMEOUT',

  NAVIGATION_FAILED = 'NAVIGATION_FAILED',

  BROWSER_LAUNCH_FAILED = 'BROWSER_LAUNCH_FAILED',

  SCAN_EXECUTION_FAILED = 'SCAN_EXECUTION_FAILED',
}

export class ScanExecutionError extends Error {
  constructor(
    readonly code: ScanFailureCode,
    message: string,
  ) {
    super(message);

    this.name = 'ScanExecutionError';
  }
}
