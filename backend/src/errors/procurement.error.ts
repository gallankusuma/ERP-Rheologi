import { respondWithDomainError } from './domain.error';
// typed domain errors for procurement module
// maps to exact HTTP status codes via the error mapper

export type ProcurementErrorCode =
  | 'NOT_FOUND'
  | 'AUTH_PRINCIPAL_INVALID'
  | 'USER_INACTIVE'
  | 'INSUFFICIENT_PERMISSION'
  | 'INVALID_STATE_TRANSITION'
  | 'OVER_RECEIPT'
  | 'QC_SPEC_REQUIRED'
  | 'INVALID_GRN_LINE'
  | 'MISSING_LINEAGE'
  | 'IDEMPOTENCY_REPLAY'
  | 'IDEMPOTENCY_MISMATCH'
  | 'SEGREGATION_VIOLATION'
  | 'VALIDATION_ERROR'
  | 'EMPTY_RECEIPT';

const CODE_TO_STATUS: Record<ProcurementErrorCode, number> = {
  NOT_FOUND: 404,
  AUTH_PRINCIPAL_INVALID: 401,
  USER_INACTIVE: 403,
  INSUFFICIENT_PERMISSION: 403,
  INVALID_STATE_TRANSITION: 422,
  OVER_RECEIPT: 409,
  QC_SPEC_REQUIRED: 422,
  INVALID_GRN_LINE: 422,
  MISSING_LINEAGE: 422,
  IDEMPOTENCY_REPLAY: 200,
  IDEMPOTENCY_MISMATCH: 409,
  SEGREGATION_VIOLATION: 403,
  VALIDATION_ERROR: 400,
  EMPTY_RECEIPT: 422,
};

export class ProcurementDomainError extends Error {
  public readonly code: ProcurementErrorCode;
  public readonly httpStatus: number;
  public readonly data?: any;

  constructor(code: ProcurementErrorCode, message: string, data?: any) {
    super(message);
    this.name = 'ProcurementDomainError';
    this.code = code;
    this.httpStatus = CODE_TO_STATUS[code] || 500;
    this.data = data;
  }
}

// express error mapper: converts ProcurementDomainError to exact HTTP response
export function mapProcurementError(error: unknown, res: any): void {
  if (error instanceof ProcurementDomainError) {
    const body: any = { error: error.message, code: error.code };
    if (error.data) body.data = error.data;
    res.status(error.httpStatus).json(body);
    return;
  }

  // domain errors raised by shared services (valuation, costing) carry their own contract
  if (respondWithDomainError(error, res)) return;

  // fallback for unexpected errors
  const msg = error instanceof Error ? error.message : 'Unknown error';
  console.error('Procurement unhandled error:', msg);
  res.status(500).json({ error: msg, code: 'INTERNAL_ERROR' });
}
