import { describe, expect, test, spyOn } from 'bun:test';
import { runActions, runUndos } from './runner';
import type { TourAction, TourContext } from './types';

const ctx = { mapRef: { current: null }, isMobile: false } as TourContext;

function action(name: string, log: string[], withUndo = true): TourAction {
  return {
    name,
    run: async () => {
      log.push(`run ${name}`);
      return withUndo ? () => log.push(`undo ${name}`) : undefined;
    },
  };
}

describe('runner', () => {
  test('runs actions in order and undoes them in reverse', async () => {
    const log: string[] = [];
    const undos = await runActions([action('a', log), action('b', log, false), action('c', log)], ctx);
    runUndos(undos);
    expect(log).toEqual(['run a', 'run b', 'run c', 'undo c', 'undo a']);
  });

  test('a failing action does not stop the rest', async () => {
    const log: string[] = [];
    const broken: TourAction = { name: 'broken', run: () => { throw new Error('boom'); } };
    const consoleSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const undos = await runActions([broken, action('ok', log)], ctx);
    consoleSpy.mockRestore();
    expect(log).toEqual(['run ok']);
    expect(undos).toHaveLength(1);
  });

  test('a failing undo does not stop the rest', () => {
    const log: string[] = [];
    const consoleSpy = spyOn(console, 'warn').mockImplementation(() => {});
    runUndos([() => log.push('first'), () => { throw new Error('boom'); }]);
    consoleSpy.mockRestore();
    expect(log).toEqual(['first']);
  });
});
