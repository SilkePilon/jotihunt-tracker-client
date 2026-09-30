import type { TourTargetId } from './targets';
import type { Platform, TourStep } from './types';

export function stepsForPlatform(steps: TourStep[], platform: Platform): TourStep[] {
  return steps.filter((step) => !step.only || step.only === platform);
}

export function targetFor(step: TourStep, platform: Platform): TourTargetId | null {
  const { target } = step;
  if (target === null || typeof target === 'string') return target;
  return target[platform] ?? null;
}
