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

const messages: Record<ScanFailureCode, string> = {
  TARGET_NOT_ALLOWED: 'Target is not allowed.',
  DNS_RESOLUTION_FAILED: 'Target hostname could not be resolved.',
  NAVIGATION_TIMEOUT: 'Target navigation timed out.',
  NAVIGATION_FAILED: 'Target navigation failed.',
  BROWSER_LAUNCH_FAILED: 'Unable to launch browser.',
  SCAN_EXECUTION_FAILED: 'ReactPulse could not complete the browser scan.',
};
export function normalizeFailure(error: unknown) {
  const code =
    error instanceof ScanExecutionError && Object.hasOwn(messages, error.code)
      ? error.code
      : ScanFailureCode.SCAN_EXECUTION_FAILED;
  return { code, message: messages[code] };
}
