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

/** Only an age band is stored, never a birth date. */
export const ageBandSchema = z.enum(['under13', '13to15', '16plus']);
export type AgeBand = z.infer<typeof ageBandSchema>;

export const createGuestRequestSchema = z.strictObject({ ageBand: ageBandSchema });
export type CreateGuestRequest = z.infer<typeof createGuestRequestSchema>;

export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  // No control or invisible formatting characters, which could hide or spoof names.
  .regex(/^[^\p{Cc}\p{Cf}]+$/u, 'Use visible characters only.');

export const updateProfileRequestSchema = z.strictObject({ displayName: displayNameSchema });
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const accountResponseSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(['guest', 'registered']),
  displayName: z.string(),
  ageBand: ageBandSchema,
  minor: z.boolean(),
  passkeys: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});
export type AccountResponse = z.infer<typeof accountResponseSchema>;

export const consentsSchema = z.strictObject({ analytics: z.boolean() });
export type Consents = z.infer<typeof consentsSchema>;

export const deleteAccountRequestSchema = z.strictObject({ confirm: z.literal('DELETE') });
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

export const exportResponseSchema = z.strictObject({
  exportedAt: z.iso.datetime(),
  account: accountResponseSchema,
  consents: consentsSchema,
  sessions: z.array(z.strictObject({ createdAt: z.iso.datetime(), expiresAt: z.iso.datetime() })),
  passkeys: z.array(z.strictObject({ createdAt: z.iso.datetime(), lastUsedAt: z.iso.datetime().nullable() })),
});
export type ExportResponse = z.infer<typeof exportResponseSchema>;

/** The browser's WebAuthn response. Its contents are checked by the WebAuthn library on the server. */
export const passkeyCredentialSchema = z.looseObject({ id: z.string().min(1), type: z.literal('public-key') });

export const passkeyOptionsResponseSchema = z.strictObject({
  challengeId: z.uuid(),
  options: z.looseObject({ challenge: z.string() }),
});
export type PasskeyOptionsResponse = z.infer<typeof passkeyOptionsResponseSchema>;

export const passkeyVerifyRequestSchema = z.strictObject({
  challengeId: z.uuid(),
  credential: passkeyCredentialSchema,
});
export type PasskeyVerifyRequest = z.infer<typeof passkeyVerifyRequestSchema>;
