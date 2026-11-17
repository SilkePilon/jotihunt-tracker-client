import { PHONE_MENU_SECTIONS, SIDEBAR_SECTIONS, sectionOfTarget, type TourTargetId } from './targets';
import type { Platform, TourStep } from './types';

/** Where each section is on screen: the laptop sidebar's order, or the phone menu's */
const SECTION_ORDER: Record<Platform, readonly string[]> = {
  desktop: SIDEBAR_SECTIONS,
  mobile: PHONE_MENU_SECTIONS,
};

/**
 * The platform's steps. Steps that point at a sidebar section (its card, or on phones its page or menu row) follow that
 * platform's visible order (laptop sidebar or phone menu): they swap among the places the section steps take in
 * TOUR_STEPS; every other step keeps its place.
 */
export function stepsForPlatform(steps: TourStep[], platform: Platform): TourStep[] {
  const ours = steps.filter((step) => !step.only || step.only === platform);
  const order = SECTION_ORDER[platform];
  const rank = (step: TourStep) => {
    const target = targetFor(step, platform);
    const section = target === null ? null : sectionOfTarget(target);
    return section === null ? -1 : order.indexOf(section);
  };
  const sections = ours.filter((step) => rank(step) !== -1).sort((a, b) => rank(a) - rank(b));
  let next = 0;
  return ours.map((step) => (rank(step) === -1 ? step : sections[next++]));
}

export function targetFor(step: TourStep, platform: Platform): TourTargetId | null {
  const { target } = step;
  if (target === null || typeof target === 'string') return target;
  return target[platform] ?? null;
}
