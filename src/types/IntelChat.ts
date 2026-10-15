import type { UIMessage } from 'ai';
import type { AssignmentStatus } from './Intel';

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

/** decodeCipher output: ≤ 30 rows, best first */
export type DecodeResult = { results: { method: string; detail?: string; output: string }[] };

/** findPlaces output: ≤ 25, nearest first; detail e.g. bus route ref/terminus */
export type FindPlacesResult = {
  places: { name: string | null; kind: string; latLng: LatLng; rdText: string; distanceM: number; detail?: string }[];
};

/** intersect output: 0-2 candidate points, each enriched like showPoint */
export type IntersectResult = { points: PointResult[]; note?: string };

/** lookAtPoint output; imageUrl = public PDOK WMS GetMap URL of the aerial photo */
export type LookAtPointResult = { description: string; imageUrl: string; point: PointResult };

/** getAssignment output */
export type AssignmentInfo = {
  articleId: number;
  title: string;
  status: AssignmentStatus;
  owner: string | null;
  notes: { by: string; text: string; at: string }[];
  endTime: string | null;
  maxPoints: number | null;
};

/** proposeAssignmentUpdate output: only a proposal, "Opslaan" posts it */
export type AssignmentProposal = { articleId: number; title: string; status?: AssignmentStatus; note?: string };

export type OvMode = 'BUS' | 'TRAM' | 'METRO' | 'BOAT' | 'TRAIN';

/** id: OVapi StopAreaCode, or 'NS:<stationCode>' for a train station */
export type OvStop = { id: string; name: string; town: string | null; latLng: LatLng; rdText: string; distanceM: number; modes: OvMode[] };

/** ovStopsNear output: ≤ 20, nearest first */
export type OvStopsResult = { stops: OvStop[]; note?: string };

/** journeyId: OVapi journey key, or 'NS:<trainNumber>:<YYYY-MM-DD>' */
export type OvDeparture = {
  mode: OvMode;
  line: string;
  destination: string;
  planned: string;
  expected: string;
  delayMin: number;
  status: string;
  journeyId: string | null;
  platform?: string;
};

/** ovDepartures output: ≤ 30, by expected time */
export type OvDeparturesResult = { stop: OvStop; departures: OvDeparture[]; note?: string };

export type OvJourneyStop = {
  name: string;
  town: string | null;
  latLng: LatLng | null;
  planned: string | null;
  expected: string | null;
  status: 'PASSED' | 'ARRIVED' | 'DEPARTED' | 'DRIVING' | 'PLANNED' | 'CANCEL' | 'UNKNOWN';
};

/** ovJourney output */
export type OvJourneyResult = {
  mode: OvMode;
  line: string;
  destination: string;
  stops: OvJourneyStop[];
  current: { latLng: LatLng; rdText: string; between: [string, string]; note: string } | null;
};

export type OvCandidateKind = 'onboard' | 'alighted' | 'terminus' | 'waiting';

export type OvCandidate = {
  point: PointResult;
  /** e.g. "bus 83 → Warnsveld (vertrek 15:08 Station Zutphen)" */
  via: string;
  kind: OvCandidateKind;
  atTime: string;
  /** 0..1 */
  score: number;
  why: string;
  journeyId: string | null;
};

/** predictOvMovement output: ≤ 10, best first */
export type OvPredictionResult = { candidates: OvCandidate[]; assumptions: string[]; note?: string };

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
  | 'proposeHintAnswer'
  | 'decodeCipher'
  | 'findPlaces'
  | 'intersect'
  | 'lookAtPoint'
  | 'getAssignment'
  | 'proposeAssignmentUpdate'
  | 'ovStopsNear'
  | 'ovDepartures'
  | 'ovJourney'
  | 'predictOvMovement';

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
