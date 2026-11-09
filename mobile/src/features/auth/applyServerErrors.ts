import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../../services/api/errors';

/** Maps API validation details onto form fields; returns a general message for anything else. */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>,
  map: Record<string, Path<T>> = {}): string | null {
  if (!(err instanceof ApiError)) return null;
  let general: string | null = err.kind === 'http' ? err.message : null;
  for (const [field, msgs] of Object.entries(err.fieldErrors)) {
    const target = map[field] ?? (field as Path<T>);
    try { setError(target, { type: 'server', message: msgs[0] }); general = field === 'non_field_errors' ? msgs[0] : general; }
    catch { general = msgs[0]; }
  }
  if (Object.keys(err.fieldErrors).length) general = err.code === 'validation_error' ? null : general;
  return general;
}
