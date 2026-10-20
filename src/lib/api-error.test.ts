import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { apiErrorMessage } from './api-error';

function axiosError(data: unknown, status = 400): AxiosError {
  const response = { data, status, statusText: 'Bad Request', headers: {}, config: { headers: new AxiosHeaders() } } as AxiosResponse;
  return new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', undefined, undefined, response);
}

describe('apiErrorMessage', () => {
  test('uses the server message', () => {
    expect(apiErrorMessage(axiosError({ message: 'Code bestaat al' }), 'fallback')).toBe('Code bestaat al');
  });

  test('falls back to the first validation error', () => {
    expect(apiErrorMessage(axiosError({ errors: [{ msg: 'Ongeldige code' }, { msg: 'Tweede' }] }), 'fallback')).toBe('Ongeldige code');
  });

  test('message wins over validation errors', () => {
    expect(apiErrorMessage(axiosError({ message: 'Eerst', errors: [{ msg: 'Daarna' }] }), 'fallback')).toBe('Eerst');
  });

  test('archive message for a 423, also without a body', () => {
    expect(apiErrorMessage(axiosError({ message: 'Archief is alleen-lezen' }, 423), 'fallback')).toBe('Archief is alleen-lezen');
    expect(apiErrorMessage(axiosError(undefined, 423), 'fallback')).toBe('Archief is alleen-lezen');
  });

  test('fallback for empty or non-string messages, missing bodies and non-axios errors', () => {
    expect(apiErrorMessage(axiosError({ message: '' }), 'fallback')).toBe('fallback');
    expect(apiErrorMessage(axiosError({ message: 42, errors: [] }), 'fallback')).toBe('fallback');
    expect(apiErrorMessage(axiosError(undefined), 'fallback')).toBe('fallback');
    expect(apiErrorMessage(axiosError('<html>502</html>'), 'fallback')).toBe('fallback');
    expect(apiErrorMessage(new AxiosError('Network Error'), 'fallback')).toBe('fallback');
    expect(apiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
    expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
