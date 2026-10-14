export interface Article {
  id: number;
  title: string;
  type: string;
  /** ISO date string from the API */
  publishAt: Date;
  content: string;
  messageType: string;
  maxPoints: number;
  endTime: Date;
  /** Short Dutch summary made by the server (news and assignments); missing until made */
  summary?: string;
}
