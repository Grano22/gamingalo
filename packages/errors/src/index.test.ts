import { describe, expect, it } from 'vitest';
import { GamingaloError, isGamingaloError } from './index';

describe('GamingaloError', () => {
  it('exposes the code, message and cause', () => {
    const cause = new Error('socket closed');
    const error = new GamingaloError('NETWORK_OFFLINE', 'No connection', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('GamingaloError');
    expect(error.code).toBe('NETWORK_OFFLINE');
    expect(error.message).toBe('No connection');
    expect(error.cause).toBe(cause);
  });

  it('takes the retryable flag from the code', () => {
    expect(new GamingaloError('NETWORK_OFFLINE', 'x').retryable).toBe(true);
    expect(new GamingaloError('INVALID_CONFIG', 'x').retryable).toBe(false);
  });
});

describe('isGamingaloError', () => {
  it('recognizes SDK errors and rejects everything else', () => {
    expect(isGamingaloError(new GamingaloError('INTERNAL', 'x'))).toBe(true);
    expect(isGamingaloError(new Error('x'))).toBe(false);
    expect(isGamingaloError({ code: 'INTERNAL' })).toBe(false);
    expect(isGamingaloError(null)).toBe(false);
  });
});
