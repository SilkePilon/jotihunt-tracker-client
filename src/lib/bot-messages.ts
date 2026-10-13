import { formatClock } from '@/lib/format';
import type { GlyphName, MarkerPalette } from '@/lib/marker-style';
import type { TelegramLink } from '@/lib/telegram';
import type { BotMessage, BotMessageKind } from '@/types/Telegram';

/** Solid red of the tegenhunt cookie (also the Tegenhunt card's cookie), with a white glyph in both themes. */
export const TEGENHUNT_RED = '#dc2626';

type PaletteRole = keyof MarkerPalette;

interface BotMessageStyle {
  label: string;
  glyph: GlyphName;
  /** Marker palette roles of the flat circle; the tegenhunt is a solid red cookie instead */
  container: PaletteRole | 'tegenhunt';
  on: PaletteRole | 'tegenhunt';
}

/** Marker per message kind, like the map markers (container colour + on-colour Material Symbol), but flat. */
export const BOT_MESSAGE_STYLE: Record<BotMessageKind, BotMessageStyle> = {
  tegenhunt: { label: 'Tegenhunt', glyph: 'e911_emergency', container: 'tegenhunt', on: 'tegenhunt' },
  'hunt-approved': { label: 'Hunt goedgekeurd', glyph: 'check', container: 'okContainer', on: 'onOkContainer' },
  'hunt-rejected': { label: 'Hunt afgekeurd', glyph: 'close', container: 'errorContainer', on: 'onErrorContainer' },
  assignment: { label: 'Opdracht', glyph: 'assignment_turned_in', container: 'tertiaryContainer', on: 'onTertiaryContainer' },
  'happy-hour': { label: 'Happy hour', glyph: 'celebration', container: 'warnContainer', on: 'onWarnContainer' },
  other: { label: 'Bericht', glyph: 'chat', container: 'surfaceContainerHighest', on: 'onSurfaceVariant' },
};

/** Unknown kinds (a newer server) show as a plain message. */
export function botMessageStyle(kind: string): BotMessageStyle {
  return BOT_MESSAGE_STYLE[kind as BotMessageKind] ?? BOT_MESSAGE_STYLE.other;
}

/** The marker's colours in a theme: fill and glyph. */
export function botMarkerColors(kind: string, palette: MarkerPalette): { shape: 'circle' | 'cookie'; fill: string; glyph: string } {
  const style = botMessageStyle(kind);
  if (style.container === 'tegenhunt' || style.on === 'tegenhunt') return { shape: 'cookie', fill: TEGENHUNT_RED, glyph: '#ffffff' };
  return { shape: 'circle', fill: palette[style.container], glyph: palette[style.on] };
}

/** Collapsed "Jotihunt-berichten" summary: "21:14 · Tegenhunt" for the newest message; undefined without messages. */
export function telegramSummary(messages: BotMessage[] | undefined): string | undefined {
  const newest = messages?.[0];
  return newest ? `${formatClock(newest.receivedAt)} · ${botMessageStyle(newest.kind).label}` : undefined;
}

/**
 * The collapsed "Jotihunt-berichten" header: amber "Geen verbinding" while the server is reconnecting (messages can't
 * come in), else the newest message, else "Niet gekoppeld" when not linked.
 */
export function telegramHeaderSummary(messages: BotMessage[] | undefined, link: TelegramLink | undefined): { text: string; tone?: 'warn' } | undefined {
  if (link === 'disconnected') return { text: 'Geen verbinding', tone: 'warn' };
  const newest = telegramSummary(messages);
  if (newest) return { text: newest };
  return link === 'unlinked' ? { text: 'Niet gekoppeld' } : undefined;
}
