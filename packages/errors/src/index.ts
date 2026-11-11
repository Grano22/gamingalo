const { defineProperty, freeze, hasOwn } = Object;

/** Stable error codes. Codes are public API: add new ones, but never rename or reuse them. */
export const ERROR_DEFINITIONS = freeze({
  SDK_NOT_INITIALIZED: freeze({ retryable: false }),
  SDK_ALREADY_INITIALIZED: freeze({ retryable: false }),
  INVALID_CONFIG: freeze({ retryable: false }),
  INVALID_ARGUMENT: freeze({ retryable: false }),
  NOT_FOUND: freeze({ retryable: false }),
  CONFLICT: freeze({ retryable: false }),
  UNAUTHENTICATED: freeze({ retryable: false }),
  FORBIDDEN: freeze({ retryable: false }),
  REAUTHENTICATION_REQUIRED: freeze({ retryable: false }),
  PARENTAL_CONSENT_REQUIRED: freeze({ retryable: false }),
  RATE_LIMITED: freeze({ retryable: true }),
  SERVICE_UNAVAILABLE: freeze({ retryable: true }),
  FEATURE_UNAVAILABLE: freeze({ retryable: false }),
  NETWORK_OFFLINE: freeze({ retryable: true }),
  STORAGE_UNAVAILABLE: freeze({ retryable: true }),
  STORAGE_QUOTA_EXCEEDED: freeze({ retryable: false }),
  SAVE_VERSION_TOO_NEW: freeze({ retryable: false }),
  SAVE_MIGRATION_FAILED: freeze({ retryable: false }),
  REALM_NOT_ALLOWED: freeze({ retryable: false }),
  MOCK_NOT_ALLOWED: freeze({ retryable: false }),
  PLUGIN_FAILED: freeze({ retryable: false }),
  INTERNAL: freeze({ retryable: false }),
}) satisfies Record<string, { retryable: boolean }>;

export type ErrorCode = keyof typeof ERROR_DEFINITIONS;

const BRAND = Symbol.for('gamingalo.error');

/**
 * The class and its prototype are frozen, and an error's fields are read-only, so they can't be
 * changed after it's created. Instances stay extensible, because loggers and error reporting
 * tools add their own markers to errors, and fail if they can't.
 */
export class GamingaloError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly [BRAND] = true;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GamingaloError';
    this.code = code;
    this.retryable = ERROR_DEFINITIONS[code].retryable;
    for (const field of ['name', 'message', 'cause', 'code', 'retryable', BRAND]) {
      if (hasOwn(this, field)) {
        defineProperty(this, field, { __proto__: null, writable: false, configurable: false } as PropertyDescriptor);
      }
    }
  }
}

freeze(GamingaloError.prototype);
freeze(GamingaloError);

/**
 * Works across bundles, where `instanceof` fails because each bundle has its own class.
 * Identifies an error for handling, but can be imitated, so it isn't a security check.
 */
export function isGamingaloError(value: unknown): value is GamingaloError {
  return typeof value === 'object' && value !== null && hasOwn(value, BRAND);
}

freeze(isGamingaloError);
