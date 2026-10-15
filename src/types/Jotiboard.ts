/** Admin status of the Jotiboard sync (GET /admin/jotiboard). */
export interface JotiboardCounts {
  pins: number;
  hints: number;
}

export interface JotiboardLinkedStatus {
  state: 'linked';
  username: string;
  linkedAt: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  counts: JotiboardCounts;
}

export type JotiboardStatus =
  | { state: 'unavailable' }
  | { state: 'unlinked'; counts: JotiboardCounts }
  | JotiboardLinkedStatus
  | { state: 'loggedOut'; username: string; counts: JotiboardCounts };
