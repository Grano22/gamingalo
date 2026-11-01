/** Stable error codes. Codes are public API: add new ones, but never rename or reuse them. */
export const ERROR_DEFINITIONS = {
  SDK_NOT_INITIALIZED: { retryable: false },
  SDK_ALREADY_INITIALIZED: { retryable: false },
  INVALID_CONFIG: { retryable: false },
  INVALID_ARGUMENT: { retryable: false },
  FEATURE_UNAVAILABLE: { retryable: false },
  NETWORK_OFFLINE: { retryable: true },
  STORAGE_UNAVAILABLE: { retryable: true },
  STORAGE_QUOTA_EXCEEDED: { retryable: false },
  INTERNAL: { retryable: false },
} as const satisfies Record<string, { retryable: boolean }>;

export type ErrorCode = keyof typeof ERROR_DEFINITIONS;

const BRAND = Symbol.for('gamingalo.error');

export class GamingaloError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly [BRAND] = true;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GamingaloError';
    this.code = code;
    this.retryable = ERROR_DEFINITIONS[code].retryable;
  }
}

/** Works across bundles, where `instanceof` fails because each bundle has its own class. */
export function isGamingaloError(value: unknown): value is GamingaloError {
  return typeof value === 'object' && value !== null && BRAND in value;
}
