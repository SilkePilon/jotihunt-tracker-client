/** A Life360 circle the linked account is a member of. */
export interface Life360Circle {
  id: string;
  name: string;
}

/** GET /admin/life360, and the 2xx answer of the admin POST / DELETE routes (admins). Times are ISO strings. */
export type Life360AdminStatus =
  | { state: 'unavailable' } // LIFE360_SESSION_KEY missing on the server
  | { state: 'unlinked' }
  | { state: 'code'; email: string; resendAt: string } // code sent, waiting for the 6 digits
  | { state: 'circle'; email: string; circles: Life360Circle[] } // token ok, > 1 circle: admin picks one
  | { state: 'linked'; email: string; circleName: string; memberCount: number; liveCount: number; lastPollAt: string | null; refreshAvailableAt: string | null }
  | { state: 'loggedOut'; email: string; circleName: string } // Life360 answered 401
  | { state: 'paused'; email: string; circleName: string; retryAt: string; memberCount: number; liveCount: number };

export type Life360State = Life360AdminStatus['state'];
export type Life360LinkedStatus = Extract<Life360AdminStatus, { state: 'linked' }>;
/** Linked before, but the server can't read the circle right now. */
export type Life360ProblemStatus = Extract<Life360AdminStatus, { state: 'loggedOut' | 'paused' }>;

export interface Life360Location {
  lat: number;
  lon: number;
  accuracyM: number;
  at: string;
  driving: boolean;
  speedKmh: number | null;
  battery: number | null;
  charging: boolean;
}

export interface Life360Member {
  id: string;
  /** firstName + ' ' + first letter of lastName + '.' */
  name: string;
  /** e.g. "SP" */
  initials: string;
  /** '/life360/avatar/<id>' (relative to the API base) when Life360 has an avatar */
  avatarUrl: string | null;
  /** null = not sharing / no fix */
  location: Life360Location | null;
}

/** GET /life360/members (every logged-in user). `stale`: the link is logged out or paused, positions are the last known. */
export interface Life360Members {
  linked: boolean;
  stale: boolean;
  members: Life360Member[];
}
