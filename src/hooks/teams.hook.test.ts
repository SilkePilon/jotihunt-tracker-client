import { afterEach, describe, expect, test } from 'bun:test';
import { DEFAULT_CONFIG, useAppConfigStore } from '@/lib/app-config';
import type { Team } from '@/types/Team';
import { isHomeTeam } from './teams.hook';

const team = (apiId: number) => ({ apiId }) as Team;

describe('isHomeTeam', () => {
  afterEach(() => useAppConfigStore.setState({ config: DEFAULT_CONFIG, loaded: false }));

  test('no home team configured: never ours', () => {
    expect(isHomeTeam(team(7))).toBe(false);
  });

  test('matches the configured api id', () => {
    useAppConfigStore.getState().setConfig({ ...DEFAULT_CONFIG, homeTeamApiId: 7 });
    expect(isHomeTeam(team(7))).toBe(true);
    expect(isHomeTeam(team(8))).toBe(false);
  });
});
