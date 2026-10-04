import type { HintCell, HintNote, UserRef } from './HintCell';

export type IntelType = 'hint' | 'assignment' | 'news';

export type AssignmentStatus = 'open' | 'busy' | 'submitted' | 'skipped';

/** Our own bookkeeping of an assignment article; articles without one are open and unowned */
export interface Assignment {
  _id: string;
  articleId: number;
  status: AssignmentStatus;
  statusBy?: UserRef | null;
  statusAt?: string;
  owner?: UserRef | null;
  ownerBy?: UserRef | null;
  ownerAt?: string;
  notes: HintNote[];
}

export interface ReadState {
  /** Ids of the articles the current user opened */
  read: number[];
  /** Per article id, how many users opened it */
  readBy: Record<string, number>;
}

export interface PresenceEntry {
  userId: string;
  name: string;
  itemId: number;
  area?: string;
  at: number;
}

/** What a guarded write would overwrite (the `conflict` of a 409) */
export interface WriteConflict {
  kind: 'answer' | 'claim' | 'status' | 'owner';
  value: string | null;
  by: UserRef | null;
  at: string | null;
}

/** One row of the hints page: an article with what we know about it */
export interface IntelItem {
  id: number;
  type: IntelType;
  title: string;
  publishAt: string;
  content: string;
  /** Hints: the cells per area (may be empty while the board loads) */
  cells: HintCell[];
  /** Assignments */
  endTime?: string;
  maxPoints?: number;
  assignment?: Assignment;
  /** News and assignments */
  summary?: string;
  summaryPoints: string[];
  unread: boolean;
  readBy: number;
}

export interface IntelFilter {
  type: IntelType | 'all';
  query: string;
  /** Only what still needs attention */
  openOnly: boolean;
}

export interface Selection {
  itemId?: number;
  area?: string;
}

/** Flags a guarded write is sent with */
export interface WriteFlags {
  overwrite: boolean;
  replaceMarker: boolean;
}
