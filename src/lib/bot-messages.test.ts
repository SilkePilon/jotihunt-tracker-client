import { describe, expect, test } from 'bun:test';
import { GLYPHS } from '@/components/layers/marker-glyphs';
import { BOT_MESSAGE_STYLE, botMarkerColors, botMessageStyle, telegramHeaderSummary, telegramSummary, TEGENHUNT_RED } from './bot-messages';
import { formatClock } from './format';
import { MARKER_PALETTES } from './marker-style';
import type { BotMessage, BotMessageKind } from '@/types/Telegram';

describe('BOT_MESSAGE_STYLE', () => {
  test('labels as in the spec', () => {
    const labels = Object.fromEntries(Object.entries(BOT_MESSAGE_STYLE).map(([kind, style]) => [kind, style.label]));
    expect(labels).toEqual({
      tegenhunt: 'Tegenhunt',
      'hunt-approved': 'Hunt goedgekeurd',
      'hunt-rejected': 'Hunt afgekeurd',
      assignment: 'Opdracht',
      'happy-hour': 'Happy hour',
      other: 'Bericht',
    });
  });

  test('every glyph has path data', () => {
    for (const style of Object.values(BOT_MESSAGE_STYLE)) expect(GLYPHS[style.glyph]).toStartWith('M');
  });

  test('unknown kinds fall back to a plain message', () => {
    expect(botMessageStyle('something-new')).toBe(BOT_MESSAGE_STYLE.other);
  });
});

describe('botMarkerColors', () => {
  test('palette container + on colour', () => {
    const dark = MARKER_PALETTES.dark;
    expect(botMarkerColors('hunt-approved', dark)).toEqual({ shape: 'circle', fill: dark.okContainer, glyph: dark.onOkContainer });
    expect(botMarkerColors('happy-hour', MARKER_PALETTES.light).fill).toBe(MARKER_PALETTES.light.warnContainer);
    expect(botMarkerColors('other', MARKER_PALETTES.light).glyph).toBe(MARKER_PALETTES.light.onSurfaceVariant);
  });

  test('the tegenhunt is a solid red cookie with a white glyph in both themes', () => {
    for (const palette of Object.values(MARKER_PALETTES)) {
      expect(botMarkerColors('tegenhunt', palette)).toEqual({ shape: 'cookie', fill: TEGENHUNT_RED, glyph: '#ffffff' });
    }
  });
});

describe('telegramSummary', () => {
  const message = (kind: BotMessageKind, receivedAt: string): BotMessage => ({ id: receivedAt, text: '', kind, receivedAt });

  test('time and label of the newest (first) message', () => {
    const newest = '2026-10-17T19:14:00.000Z';
    expect(telegramSummary([message('tegenhunt', newest), message('other', '2026-10-17T18:00:00.000Z')])).toBe(`${formatClock(newest)} · Tegenhunt`);
  });

  test('nothing without messages', () => {
    expect(telegramSummary([])).toBeUndefined();
    expect(telegramSummary(undefined)).toBeUndefined();
  });
});

describe('telegramHeaderSummary', () => {
  const newest = '2026-10-17T19:14:00.000Z';
  const messages: BotMessage[] = [{ id: '1', text: '', kind: 'happy-hour', receivedAt: newest }];

  test('amber "Geen verbinding" wins while reconnecting', () => {
    expect(telegramHeaderSummary(messages, 'disconnected')).toEqual({ text: 'Geen verbinding', tone: 'warn' });
    expect(telegramHeaderSummary([], 'disconnected')).toEqual({ text: 'Geen verbinding', tone: 'warn' });
  });

  test('else the newest message, else "Niet gekoppeld", else nothing', () => {
    expect(telegramHeaderSummary(messages, 'connected')).toEqual({ text: `${formatClock(newest)} · Happy hour` });
    expect(telegramHeaderSummary(messages, 'unlinked')).toEqual({ text: `${formatClock(newest)} · Happy hour` });
    expect(telegramHeaderSummary([], 'unlinked')).toEqual({ text: 'Niet gekoppeld' });
    expect(telegramHeaderSummary([], 'connected')).toBeUndefined();
    expect(telegramHeaderSummary(undefined, undefined)).toBeUndefined();
  });
});
