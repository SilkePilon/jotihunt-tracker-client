import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { ResolverOptions } from 'react-hook-form';
import { areaOptions } from './utils';
import { fieldsResolver, nonEmptyString, oneOf, stringOfLength, validDate, validateFields } from './form-resolver';

const AREAS = areaOptions.map((option) => option.value);

// The zod schemas the forms used before, to prove the plain rules accept exactly the same values
const hintZod = z.object({
  area: z.enum(AREAS as [string, ...string[]]),
  time: z.string().min(1),
  x: z.string().length(6),
  y: z.string().length(6),
});
const markerZod = z.object({ area: z.enum(AREAS as [string, ...string[]]), day: z.date(), time: z.date() });

const hintRules = {
  area: oneOf(AREAS, 'Kies een deelgebied.'),
  time: nonEmptyString('Kies een tijd.'),
  x: stringOfLength(6, 'Vul 6 cijfers in.'),
  y: stringOfLength(6, 'Vul 6 cijfers in.'),
};
const markerRules = {
  area: oneOf(AREAS, 'Geen geldig deelgebied.'),
  day: validDate('Geen geldige dag.'),
  time: validDate('Geen geldige tijd.'),
};

/** Field names that fail, per zod */
function zodFailures(schema: z.ZodType, values: unknown) {
  const result = schema.safeParse(values);
  return result.success ? [] : [...new Set(result.error.issues.map((issue) => String(issue.path[0])))].sort();
}

const failures = (errors: object) => Object.keys(errors).sort();

const strings = ['', 'a', '12345', '123456', '1234567', '12?456', ' 23456', 'alpha', 'Alpha', 'oscar', 'zulu', '2026-10-17T09:00:00.000Z'];
const nonStrings = [undefined, null, 0, 123456, new Date(0), {}, ['alpha']];

describe('hint entry rules match the old zod schema', () => {
  test('every combination of interesting values', () => {
    const values = [...strings, ...nonStrings];
    for (const area of values) for (const time of values) for (const x of ['', '123456', '12345', 123456, undefined]) for (const y of ['123456', '1234567', null]) {
      const input = { area, time, x, y };
      expect({ input, fails: failures(validateFields(input as never, hintRules)) }).toEqual({ input, fails: zodFailures(hintZod, input) });
    }
  });
});

describe('marker registration rules match the old zod schema', () => {
  test('every combination of interesting values', () => {
    const dates = [new Date(), new Date(0), new Date(NaN), '2026-10-17', 0, undefined, null];
    for (const area of [...strings, ...nonStrings]) for (const day of dates) for (const time of dates) {
      const input = { area, day, time };
      expect({ input, fails: failures(validateFields(input as never, markerRules)) }).toEqual({ input, fails: zodFailures(markerZod, input) });
    }
  });
});

describe('fieldsResolver', () => {
  const options = { fields: {}, shouldUseNativeValidation: false } as ResolverOptions<Record<string, unknown>>;

  test('valid values come back without unknown keys and without errors', async () => {
    const resolver = fieldsResolver(hintRules);
    const result = await resolver({ area: 'delta', time: 't', x: '123456', y: '654321', extra: 1 } as never, undefined, options as never);
    expect(result).toEqual({ values: { area: 'delta', time: 't', x: '123456', y: '654321' }, errors: {} });
  });

  test('invalid values give a Dutch message per field and the field ref', async () => {
    const ref = { name: 'x' };
    const resolver = fieldsResolver(hintRules);
    const result = await resolver({ area: '', time: '', x: '12', y: '123456' }, undefined, { ...options, fields: { x: { ref, name: 'x' } } } as never);
    expect(result.values).toEqual({});
    expect(result.errors).toEqual({
      area: { type: 'validate', message: 'Kies een deelgebied.', ref: undefined },
      time: { type: 'validate', message: 'Kies een tijd.', ref: undefined },
      x: { type: 'validate', message: 'Vul 6 cijfers in.', ref },
    } as never);
  });

  test('the marker form keeps its Dutch area message', async () => {
    const resolver = fieldsResolver(markerRules);
    const result = await resolver({ area: 'zulu', day: new Date(), time: new Date(NaN) }, undefined, options as never);
    expect(result.errors.area?.message).toBe('Geen geldig deelgebied.');
    expect(result.errors.time?.message).toBe('Geen geldige tijd.');
    expect(result.errors.day).toBeUndefined();
  });
});
