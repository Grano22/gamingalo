import { describe, expect, it } from 'vitest';
import { errorResponseSchema, healthResponseSchema, metaResponseSchema } from './index';

describe('contracts', () => {
  it('accepts valid responses', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
    expect(metaResponseSchema.parse({ service: 'api', version: '1.0.0', apiVersion: 'v1' }).apiVersion).toBe('v1');
  });

  it('rejects unknown fields, so internal data cannot leak through a response', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok', secret: 'x' }).success).toBe(false);
    expect(
      errorResponseSchema.safeParse({ error: { code: 'INTERNAL', message: 'x', requestId: 'r', stack: 's' } }).success,
    ).toBe(false);
  });
});
