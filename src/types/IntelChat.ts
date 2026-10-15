import type { UIMessage } from 'ai';

/** Shapes of the intel chat contract (docs/superpowers/specs/2026-10-15-intel-ai-chat-contract.md). */

export type LatLng = { lat: number; lng: number };
export type Rd = { x: number; y: number };

export type AreaEstimate = {
  /** e.g. 'alpha'; null when unknown */
  area: string | null;
  method: 'hull' | 'nearest-group' | 'none';
};

export type NearGroup = { name: string; area: string | null; distanceM: number };

/** showPoint output */
export type PointResult = {
  label: string;
  latLng: LatLng;
  rd: Rd;
  /** formatRdAnswer, e.g. "152341 431112" */
  rdText: string;
  area: AreaEstimate;
  nearestGroup: NearGroup | null;
};

/** proposeHintAnswer output */
export type HintAnswerProposal = {
  articleId: number;
  area: string;
  /** Exactly what "Zet als antwoord" posts */
  answer: string;
  kind: 'rd' | 'text';
  /** Set when kind === 'rd' */
  point: PointResult | null;
};

/** checkPoint output */
export type CheckPointResult = {
  point: PointResult;
  nearestGroups: NearGroup[];
  insideNl: boolean;
  otherHintPoints: { articleTitle: string; slotTime: string | null; distanceM: number }[];
  nearestTracker: { name: string; distanceM: number; ageMin: number } | null;
};

/** webSearch output */
export type WebSearchResult = { answer: string; sources: { title: string; url: string }[] };

export type IntelToolName =
  | 'getItem'
  | 'searchIntel'
  | 'getHintBoard'
  | 'getAreas'
  | 'getFoxHistory'
  | 'getOurTeams'
  | 'convertCoordinates'
  | 'checkPoint'
  | 'nearbyGroups'
  | 'distance'
  | 'projectPoint'
  | 'geocode'
  | 'reverseGeocode'
  | 'webSearch'
  | 'readWebPage'
  | 'runCode'
  | 'showPoint'
  | 'proposeHintAnswer';

/** Icon colour of a tool: app data (warn), map (ok), web (cooldown), think (purple) */
export type ToolTone = 'app' | 'map' | 'web' | 'think';

/** Prompt box modes, kept per user */
export interface ChatModes {
  web: boolean;
  deep: boolean;
}

/** Body of POST /intel-chat/:articleId */
export interface IntelChatRequest {
  message: UIMessage;
  web: boolean;
  deep: boolean;
}
