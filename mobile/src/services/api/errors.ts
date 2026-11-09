import { isAxiosError, isCancel } from 'axios';
import type { ApiErrorBody } from '../../types/api';

export type ApiErrorKind = 'network' | 'timeout' | 'cancelled' | 'http' | 'unknown';

/** Normalised error thrown by every API call. Presentation code never inspects Axios errors directly. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly requestId: string | null;

  constructor(opts: { kind: ApiErrorKind; message: string; status?: number | null; code?: string;
    fieldErrors?: Record<string, string[]>; requestId?: string | null }) {
    super(opts.message);
    this.name = 'ApiError';
    this.kind = opts.kind;
    this.status = opts.status ?? null;
    this.code = opts.code ?? opts.kind;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.requestId = opts.requestId ?? null;
  }

  get isOffline() { return this.kind === 'network' || this.kind === 'timeout'; }
  get isAuth() { return this.status === 401; }
  fieldError(field: string): string | undefined { return this.fieldErrors[field]?.[0]; }
}

function flattenDetails(details: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!details || typeof details !== 'object') return out;
  for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v.map(String);
    else if (typeof v === 'string') out[k] = [v];
    else if (v && typeof v === 'object') out[k] = Object.values(flattenDetails(v)).flat();
  }
  return out;
}

export function normaliseError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isCancel(err)) return new ApiError({ kind: 'cancelled', message: 'Request cancelled' });
  if (isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: 'The server took too long to respond.' });
    }
    if (!err.response) {
      return new ApiError({ kind: 'network', message: 'Can’t reach Zpot. Check your connection.' });
    }
    const body = err.response.data as Partial<ApiErrorBody> | undefined;
    const e = body?.error;
    return new ApiError({
      kind: 'http', status: err.response.status, code: e?.code ?? `http_${err.response.status}`,
      message: e?.message ?? 'Something went wrong.', fieldErrors: flattenDetails(e?.details),
      requestId: e?.request_id ?? null,
    });
  }
  return new ApiError({ kind: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' });
}
