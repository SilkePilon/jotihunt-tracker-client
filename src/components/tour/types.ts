import type { RefObject } from 'react';
import type { MapRef } from '@/components/Map';
import type { TourTargetId } from './targets';

export type Platform = 'mobile' | 'desktop';
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/** Reverts what an action did. */
export type Undo = () => void;

export interface TourContext {
  mapRef: RefObject<MapRef | null>;
  isMobile: boolean;
}

/** A reusable UI action (see actions.ts). `run` may return an Undo; the runner calls it when leaving the step. */
export interface TourAction {
  name: string;
  run: (ctx: TourContext) => void | Undo | Promise<void | Undo>;
}

export interface TourStep {
  /** Unique, stable id */
  id: string;
  /** null = centered card without spotlight; an object picks a target per platform */
  target: TourTargetId | null | Partial<Record<Platform, TourTargetId | null>>;
  /** Dutch */
  title: string;
  /** Dutch */
  body: string;
  /** Run in order when the step is entered; undone in reverse when it is left */
  actions?: TourAction[];
  /** Overrides the length-based duration */
  durationMs?: number;
  /** Default 'auto' */
  placement?: Placement;
  /** Only show on this platform */
  only?: Platform;
  /** Skip the step (in the current direction) when its target is not in the DOM, e.g. a feature that is turned off */
  optional?: boolean;
  /** TOUR_VERSION that introduced this step; reserved for a future "what's new" tour */
  since?: number;
}
