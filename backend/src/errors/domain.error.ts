// Shared mapping for service-layer domain errors.
// A domain error carries its own HTTP status and stable code, so routes must not
// re-derive a status by matching on message text.

export interface DomainErrorShape {
  message: string;
  code: string;
  httpStatus: number;
  data?: unknown;
}

function isDomainError(error: unknown): error is DomainErrorShape {
  const e = error as any;
  return !!e && typeof e.httpStatus === 'number' && typeof e.code === 'string' && typeof e.message === 'string';
}

/**
 * Send a domain error as its exact status and code.
 * Returns false when the error is not a domain error, so the caller can fall back.
 */
export function respondWithDomainError(error: unknown, res: any): boolean {
  if (!isDomainError(error)) return false;

  const body: Record<string, unknown> = { error: error.message, code: error.code };
  if (error.data) body.data = error.data;
  res.status(error.httpStatus).json(body);
  return true;
}
