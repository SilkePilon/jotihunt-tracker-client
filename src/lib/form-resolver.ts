import { toNestErrors, validateFieldsNatively } from '@hookform/resolvers';
import type { FieldError, FieldErrors, FieldValues, Resolver } from 'react-hook-form';

/**
 * Plain react-hook-form resolvers for the two small forms (hint entry, marker registration), replacing zod
 * (~25 KB gzip for a handful of checks). Same contract as zodResolver: all values valid gives `{ values, errors: {} }`,
 * otherwise `{ values: {}, errors }` with one Dutch message per field, the field refs attached (focus on error).
 */

/** A check for one field: the error message, or null when the value is fine */
export type FieldRule = (value: unknown) => string | null;

export const oneOf = (options: readonly string[], message: string): FieldRule => (value) =>
  typeof value === 'string' && options.includes(value) ? null : message;

export const nonEmptyString = (message: string): FieldRule => (value) =>
  typeof value === 'string' && value.length >= 1 ? null : message;

export const stringOfLength = (length: number, message: string): FieldRule => (value) =>
  typeof value === 'string' && value.length === length ? null : message;

/** A Date that holds an actual moment (like z.date(): an Invalid Date fails) */
export const validDate = (message: string): FieldRule => (value) =>
  value instanceof Date && !Number.isNaN(value.getTime()) ? null : message;

/** Runs the rules; returns only the fields that failed */
export function validateFields<V extends FieldValues>(values: V, rules: { [K in keyof V]: FieldRule }): Partial<Record<keyof V, FieldError>> {
  const errors: Partial<Record<keyof V, FieldError>> = {};
  for (const name of Object.keys(rules) as (keyof V)[]) {
    const message = rules[name](values[name]);
    if (message !== null) errors[name] = { type: 'validate', message };
  }
  return errors;
}

export function fieldsResolver<V extends FieldValues>(rules: { [K in keyof V]: FieldRule }): Resolver<V> {
  return (values, _context, options) => {
    const errors = validateFields(values, rules);
    if (Object.keys(errors).length === 0) {
      if (options.shouldUseNativeValidation) validateFieldsNatively({}, options);
      // Like a zod object schema: only the known fields come out
      const parsed = Object.fromEntries(Object.keys(rules).map((name) => [name, values[name]])) as V;
      return { values: parsed, errors: {} };
    }
    return { values: {}, errors: toNestErrors(errors as FieldErrors, options) };
  };
}
