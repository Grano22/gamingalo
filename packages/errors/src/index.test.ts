import { describe, expect, it } from 'vitest';
import { ERROR_DEFINITIONS, GamingaloError, isGamingaloError } from './index';

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

describe('tamper resistance', () => {
  it('freezes errors, the class, its prototype and the definitions', () => {
    const error = new GamingaloError('INTERNAL', 'x');
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(GamingaloError)).toBe(true);
    expect(Object.isFrozen(GamingaloError.prototype)).toBe(true);
    expect(Object.isFrozen(ERROR_DEFINITIONS)).toBe(true);
    expect(Object.isFrozen(ERROR_DEFINITIONS.INTERNAL)).toBe(true);
    expect(() => {
      (error as { code: string }).code = 'NETWORK_OFFLINE';
    }).toThrow(TypeError);
  });

  it('is not fooled by a polluted prototype', () => {
    const brand = Symbol.for('gamingalo.error');
    const prototype = Object.prototype as unknown as Record<symbol, unknown>;
    prototype[brand] = true;
    try {
      expect(isGamingaloError({})).toBe(false);
    } finally {
      delete prototype[brand];
    }
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
