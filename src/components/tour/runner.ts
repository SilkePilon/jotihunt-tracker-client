import type { TourAction, TourContext, Undo } from './types';

/** Run a step's actions in order; returns their undos. A broken action is logged and skipped so the tour keeps going. */
export async function runActions(actions: TourAction[], ctx: TourContext): Promise<Undo[]> {
  const undos: Undo[] = [];
  for (const action of actions) {
    try {
      const undo = await action.run(ctx);
      if (undo) undos.push(undo);
    } catch (error) {
      console.warn(`[tour] action failed: ${action.name}`, error);
    }
  }
  return undos;
}

/** Revert a step's actions, last first. */
export function runUndos(undos: Undo[]): void {
  for (const undo of [...undos].reverse()) {
    try {
      undo();
    } catch (error) {
      console.warn('[tour] undo failed', error);
    }
  }
}
