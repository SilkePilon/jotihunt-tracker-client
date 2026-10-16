export type HuntReportStatus = 'to_submit' | 'overdue' | 'submitted' | 'judged';
/** Server-side reading of the code and time from the photo (Gemini) */
export type OcrStatus = 'pending' | 'reading' | 'done' | 'failed';
/** Who filled a field: the photo reader or HQ by hand */
export type FieldSource = 'ocr' | 'manual';

export interface HuntReport {
  _id: string;
  area: string;
  /** null until the server has read it (or HQ entered it) */
  huntCode: string | null;
  /** ISO. Effective time: the read/entered time, else the upload time (see huntTimeKnown) */
  huntTime: string;
  /** false while huntTime is only the upload time */
  huntTimeKnown: boolean;
  huntCodeSource: FieldSource | null;
  huntTimeSource: FieldSource | null;
  reportedBy: string;
  reportedByName: string;
  submittedAt: string | null;
  submittedByName: string | null;
  /** Last result on jotihunt.nl (raw status text from the site) */
  site: { status: string; points: number; seenAt: string } | null;
  createdAt: string;
  status: HuntReportStatus;
  /** ISO: huntTime + 15 min (the window to submit/confirm on jotihunt.nl) */
  deadline: string;
  /**
   * false: reported without a photo (QR hunt, confirmed by the hunter on jotihunt.nl); no code, OCR or photo urls.
   * Missing from older servers (then every report has a photo): use {@link import('@/lib/hunt-reports').reportHasPhoto}.
   */
  hasPhoto?: boolean;
  /** Server path of the photo; needs the auth header. null without a photo */
  photoUrl: string | null;
  /** Server path of a small list thumbnail (the full photo when there is none); needs the auth header. null without a photo, missing from older servers */
  thumbUrl?: string | null;
  ocrStatus: OcrStatus;
  ocrError: string | null;
  /** 0..1, only for OCR-read values */
  codeConfidence: number | null;
  timeConfidence: number | null;
  /** Sticker bounding box in the photo: [ymin, xmin, ymax, xmax], 0..1000; null when unknown */
  stickerBox: [number, number, number, number] | null;
  /** HQ should check the code/time (failed, missing or low confidence); false while still reading */
  needsReview: boolean;
  /** An older report with exactly the same code */
  duplicateOf: { id: string; reportedByName: string } | null;
}

/** A row in "Alle hunts": an own report, or a scraped jotihunt.nl hunt that nobody registered in the app. */
export type HuntListItem =
  /** sharedSite: linked to the same scraped hunt as another report (two hunters, one fox); its points count once */
  | { source: 'app'; report: HuntReport; sharedSite?: boolean }
  | { source: 'website'; hunt: import('./Hunt').Hunt };
