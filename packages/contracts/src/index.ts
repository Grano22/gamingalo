import * as z from 'zod';

/** The shape of every error a service returns. */
export const errorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const healthResponseSchema = z.strictObject({ status: z.literal('ok') });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readyResponseSchema = z.strictObject({ status: z.literal('ready') });
export type ReadyResponse = z.infer<typeof readyResponseSchema>;

export const metaResponseSchema = z.strictObject({
  service: z.string(),
  version: z.string(),
  apiVersion: z.literal('v1'),
});
export type MetaResponse = z.infer<typeof metaResponseSchema>;
