import type { HintCell, UserRef } from './HintCell';

/** What an article is in the intel window; every article type other than hint and assignment is news */
export type IntelKind = 'hint' | 'assignment' | 'news';
/** The tabs of the intel window */
export type IntelTab = 'all' | IntelKind;

/** How far we are with an assignment */
export type AssignmentStatus = 'open' | 'busy' | 'submitted' | 'skipped';

export interface AssignmentNote {
  _id: string;
  user: UserRef | null;
  text: string;
  createdAt: string;
}

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
  notes: AssignmentNote[];
}

/** Which articles the current user opened, and per article the names of everyone who opened it */
export interface ReadState {
  read: number[];
  readBy: Record<string, string[]>;
}

/** One article in the intel window, joined with its hint cells, assignment bookkeeping and read state */
export interface IntelItem {
  id: number;
  kind: IntelKind;
  title: string;
  /** ISO */
  publishAt: string;
  content: string;
  summary?: string;
  /** Hint cells of this article (hints only) */
  cells: HintCell[];
  /** ISO deadline (assignments only) */
  endTime?: string;
  maxPoints?: number;
  assignment?: Assignment;
  /** News and assignments the current user has not opened yet */
  unread: boolean;
  /** Names of the users who opened it */
  readBy: string[];
}

/** How an area of a hint stands: no cell at all = missing */
export type AreaState = 'solved' | 'open' | 'none' | 'missing';

/** Timeline items of one day */
export interface DayGroup {
  /** YYYY-MM-DD in Dutch time */
  key: string;
  /** "Vandaag · zaterdag 17 okt", "Gisteren · vrijdag 16 okt", "donderdag 15 okt" */
  label: string;
  items: IntelItem[];
}
