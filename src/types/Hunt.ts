export interface Hunt {
  _id: string;
  area: string;
  /** null/missing for QR hunts (jotihunt.nl no longer shows a code for them) */
  huntCode?: string | null;
  status: string;
  points: number;
  huntTime: Date;
  updatedAt: Date;
}
