export type HintCellStatus = 'open' | 'solving' | 'solved' | 'none';
export type HintCheck = 'unchecked' | 'verified' | 'disputed';

export interface UserRef {
  _id: string;
  name: string;
}

export interface HintNote {
  _id: string;
  user: UserRef | null;
  text: string;
  createdAt: string;
}

export interface HintCell {
  _id: string;
  articleId: number;
  area: string;
  publishAt: string;
  slotTime: string;
  snippet?: string;
  status: HintCellStatus;
  claimedBy?: UserRef | null;
  claimedAt?: string;
  answer?: string;
  answerKind?: 'rd' | 'text';
  answerLocation?: [number, number];
  markerId?: string;
  check: HintCheck;
  checkedBy?: UserRef | null;
  notes: HintNote[];
  articleChanged: boolean;
}

export interface HintArticle {
  id: number;
  title: string;
  publishAt: string;
  content: string;
}

export interface HintBoard {
  articles: HintArticle[];
  cells: HintCell[];
}

export interface RdPreview {
  x: number;
  y: number;
  lng: number;
  lat: number;
}
