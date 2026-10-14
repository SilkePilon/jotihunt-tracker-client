export type HintCellStatus = 'open' | 'solved' | 'none';

export interface UserRef {
  _id: string;
  name: string;
}

export interface HintCell {
  _id: string;
  articleId: number;
  area: string;
  publishAt: string;
  slotTime: string;
  snippet?: string;
  status: HintCellStatus;
  answer?: string;
  answerKind?: 'rd' | 'text';
  answerLocation?: [number, number];
  markerId?: string;
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
