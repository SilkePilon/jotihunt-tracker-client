export type HuntKind = 'hunt' | 'tegenhunt';
export type HuntReportStatus = 'to_submit' | 'overdue' | 'submitted' | 'judged';

export interface HuntReport {
  _id: string;
  area: string;
  huntCode: string;
  /** ISO */
  huntTime: string;
  kind: HuntKind;
  reportedBy: string;
  reportedByName: string;
  submittedAt: string | null;
  submittedByName: string | null;
  /** Last result on jotihunt.nl (raw status text from the site) */
  site: { status: string; points: number; seenAt: string } | null;
  createdAt: string;
  status: HuntReportStatus;
  /** ISO: huntTime + 30 min */
  deadline: string;
  /** Server path of the photo; needs the auth header */
  photoUrl: string;
}

/** A row in "Alle hunts": an own report, or a scraped jotihunt.nl hunt that nobody registered in the app. */
export type HuntListItem = { source: 'app'; report: HuntReport } | { source: 'website'; hunt: import('./Hunt').Hunt };
