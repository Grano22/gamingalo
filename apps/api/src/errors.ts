import { GamingaloError, isGamingaloError, type ErrorCode } from '@gamingalo/errors';
import type { ErrorResponse } from '@gamingalo/contracts';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodError } from 'zod';

const STATUS_BY_CODE: Partial<Record<ErrorCode, number>> = {
  INVALID_ARGUMENT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  REAUTHENTICATION_REQUIRED: 403,
  PARENTAL_CONSENT_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
};

function body(code: ErrorCode, message: string, requestId: string): ErrorResponse {
  return { error: { code, message, requestId } };
}

export function fail(code: ErrorCode, message: string, cause?: unknown): GamingaloError {
  return new GamingaloError(code, message, cause === undefined ? undefined : { cause });
}

/** Parses a request body, and turns a validation failure into `INVALID_ARGUMENT`. */
export function parseBody<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: ZodError } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ');
  throw fail('INVALID_ARGUMENT', details);
}

export function handleError(error: FastifyError | GamingaloError, request: FastifyRequest, reply: FastifyReply): void {
  if (isGamingaloError(error)) {
    const status = STATUS_BY_CODE[error.code] ?? 500;
    if (status >= 500) request.log.error({ err: error }, 'request failed');
    void reply.status(status).send(body(error.code, error.message, request.id));
    return;
  }

  const status = (error as FastifyError).statusCode;
  if (status === 429) {
    void reply.status(429).send(body('RATE_LIMITED', 'Too many requests. Try again in a minute.', request.id));
    return;
  }
  // Fastify's own client errors, such as bad JSON or a body that's too large.
  if (status !== undefined && status >= 400 && status < 500) {
    void reply.status(status).send(body('INVALID_ARGUMENT', error.message, request.id));
    return;
  }

  // Details stay in the logs, and never reach the client.
  request.log.error({ err: error }, 'unexpected error');
  void reply.status(500).send(body('INTERNAL', 'Something went wrong.', request.id));
}

export function handleNotFound(request: FastifyRequest, reply: FastifyReply): void {
  void reply.status(404).send(body('NOT_FOUND', 'This route does not exist.', request.id));
}

export function unavailable(message: string, cause: unknown): GamingaloError {
  return fail('SERVICE_UNAVAILABLE', message, cause);
}
