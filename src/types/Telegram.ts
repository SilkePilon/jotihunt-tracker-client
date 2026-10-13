/** GET /admin/telegram, POST /admin/telegram/link and POST /admin/telegram/password (admins). */
export interface TelegramAdminStatus {
  state: 'unavailable' | 'unlinked' | 'qr' | 'password' | 'linked';
  /** tg://login?token=… while state === 'qr' */
  url?: string;
  /** ISO, expiry of the current QR token */
  expiresAt?: string;
  /** 2FA password hint while state === 'password' */
  hint?: string;
  account?: { name: string; username?: string; phoneMasked?: string };
  linkedAt?: string;
  lastMessageAt?: string;
}

export type BotMessageKind = 'tegenhunt' | 'hunt-approved' | 'hunt-rejected' | 'assignment' | 'happy-hour' | 'other';

export interface BotMessage {
  id: string;
  text: string;
  kind: BotMessageKind;
  receivedAt: string;
}

/** GET /telegram/messages: newest first. */
export interface TelegramMessages {
  linked: boolean;
  messages: BotMessage[];
}

/** GET /counter-hunt: the latest tegenhunt (30 minutes from `startedAt`). */
export type CounterHuntView =
  | { active: true; direction: number | null; startedAt: string; endsAt: string; text?: string }
  | { active: false; last?: { direction: number | null; startedAt: string } };
