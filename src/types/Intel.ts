import type { HintCell, HintNote, UserRef } from './HintCell';

/** What an article is on the hints page; every article type other than hint and assignment is news */
export type IntelType = 'hint' | 'assignment' | 'news';

/** How far we are with an assignment */
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

/** Which articles the current user opened, and how many users opened each */
export interface ReadState {
  /** Ids of the articles the current user opened */
  read: number[];
  /** Per article id, how many users opened it */
  readBy: Record<string, number>;
}

/** A user who has an item (and, for a hint, an area) of the hints page open */
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

/** The filter above the list of the hints page */
export interface IntelFilter {
  type: IntelType | 'all';
  query: string;
  /** Only what still needs attention */
  openOnly: boolean;
}

/** The item (and hint area) selected in the page's address */
export interface Selection {
  itemId?: number;
  area?: string;
}

/** Flags a guarded write is sent with */
export interface WriteFlags {
  overwrite: boolean;
  replaceMarker: boolean;
}
