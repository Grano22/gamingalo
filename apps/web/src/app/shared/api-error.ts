import { HttpErrorResponse } from '@angular/common/http';
import { errorResponseSchema } from '@gamingalo/contracts';

/** The service's error code, or `undefined` when the request failed some other way, such as being offline. */
export function errorCode(error: unknown): string | undefined {
  if (!(error instanceof HttpErrorResponse)) return undefined;
  const parsed = errorResponseSchema.safeParse(error.error);
  return parsed.success ? parsed.data.error.code : undefined;
}

const MESSAGES: Record<string, string> = {
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again.',
  PARENTAL_CONSENT_REQUIRED: 'A parent or guardian needs to agree to this first.',
  REAUTHENTICATION_REQUIRED: 'For your security, sign in with your passkey again first.',
  UNAUTHENTICATED: 'That didn’t work. Try again.',
};

export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  const code = errorCode(error);
  return (code && MESSAGES[code]) ?? fallback;
}
