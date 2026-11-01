import { GamingaloError, isGamingaloError, type ErrorCode } from '@gamingalo/errors';
import type { ErrorResponse } from '@gamingalo/contracts';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

const STATUS_BY_CODE: Partial<Record<ErrorCode, number>> = {
  INVALID_ARGUMENT: 400,
  NOT_FOUND: 404,
  SERVICE_UNAVAILABLE: 503,
};

function body(code: ErrorCode, message: string, requestId: string): ErrorResponse {
  return { error: { code, message, requestId } };
}

export function handleError(error: FastifyError | GamingaloError, request: FastifyRequest, reply: FastifyReply): void {
  if (isGamingaloError(error)) {
    const status = STATUS_BY_CODE[error.code] ?? 500;
    if (status >= 500) request.log.error({ err: error }, 'request failed');
    void reply.status(status).send(body(error.code, error.message, request.id));
    return;
  }

  // Fastify's own client errors, such as bad JSON or a body that's too large.
  const status = (error as FastifyError).statusCode;
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
  return new GamingaloError('SERVICE_UNAVAILABLE', message, { cause });
}
