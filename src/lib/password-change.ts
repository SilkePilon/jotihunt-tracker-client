import axios, { isAxiosError, type AxiosInstance } from 'axios';

/** The server's 403 `code` for a user who must change their (admin-set) password before using the app */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

/** The API refused the request until the user changes their password. Not a session end: the user stays signed in. */
export function isPasswordChangeRequired(error: unknown): boolean {
  if (!isAxiosError<{ code?: unknown }>(error) || error.response?.status !== 403) return false;
  return error.response.data?.code === PASSWORD_CHANGE_REQUIRED;
}

const listeners = new Set<() => void>();

/** Called whenever a request got PASSWORD_CHANGE_REQUIRED. Returns the unsubscribe function. */
export function onPasswordChangeRequired(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tell the listeners when `error` is a PASSWORD_CHANGE_REQUIRED answer. Returns whether it was. */
export function reportIfPasswordChangeRequired(error: unknown): boolean {
  if (!isPasswordChangeRequired(error)) return false;
  for (const listener of listeners) listener();
  return true;
}

let installed = false;

/**
 * Watch every API response (all requests use the default axios instance): a PASSWORD_CHANGE_REQUIRED answer (e.g. the
 * flag was set while the app was open) switches the session to the password change screen. The request still fails.
 */
export function installPasswordChangeInterceptor(instance: AxiosInstance = axios) {
  if (instance === axios) {
    if (installed) return;
    installed = true;
  }
  instance.interceptors.response.use(undefined, (error: unknown) => {
    reportIfPasswordChangeRequired(error);
    return Promise.reject(error);
  });
}
