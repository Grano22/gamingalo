import { GamingaloError, isGamingaloError } from '@gamingalo/errors';

/** Converts a browser storage failure to a documented SDK error. */
export function toStorageError(error: unknown): GamingaloError {
  if (isGamingaloError(error)) return error;
  const name = (error as { name?: unknown } | null | undefined)?.name;
  if (name === 'QuotaExceededError') {
    return new GamingaloError('STORAGE_QUOTA_EXCEEDED', 'Browser storage is full.', { cause: error });
  }
  if (name === 'DataCloneError') {
    return new GamingaloError('INVALID_ARGUMENT', 'This data cannot be stored by the browser.', { cause: error });
  }
  return new GamingaloError('STORAGE_UNAVAILABLE', 'Browser storage is unavailable.', { cause: error });
}
