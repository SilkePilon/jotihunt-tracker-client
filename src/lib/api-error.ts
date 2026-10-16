import { isAxiosError } from 'axios';

interface ApiErrorBody {
  message?: unknown;
  errors?: { msg?: unknown }[];
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

/** The HTTP status of a failed API call; undefined for non-axios errors and when no answer came (offline, timeout). */
export function apiErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * The server's (Dutch) error message of a failed API call: `response.data.message`, else the first express-validator
 * `response.data.errors[].msg`, else the fallback (also for non-axios errors).
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError<ApiErrorBody>(error)) return fallback;
  const body = error.response?.data;
  return text(body?.message) ?? text(body?.errors?.[0]?.msg) ?? fallback;
}
