# Android-app Promo Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-time popup on Android phones that downloads the Jotihunt APK, guides the install and pairs the app via `jotihunt://pair`, in the picked design (B dialog with hero + split button).

**Architecture:** Pure decision/storage logic in `src/lib/android-promo.ts` (tested), a tiny zustand store, an auto-open hook that gathers conditions from existing hooks (`useAppRelease`, `useAccount`, `useTrackerStatus`, `usePairingCode`), and four presentational components in `src/components/android-promo/`, mounted in `Layout.tsx`.

**Tech Stack:** React 19, TypeScript, Tailwind v4, motion/react, zustand, bun test.

Spec: `docs/superpowers/specs/2026-10-15-android-app-promo-design.md`.

## Global Constraints

- Show only when: mobile + `/Android/i` UA + APK available + no paired app device + app not detected installed + storage allows + no tour/Meldingen/Account open; open 1.5 s after conditions hold, once per session.
- Storage key `jh-android-promo`, JSON `{ hiddenUntil?: number; never?: true }`; Later = 3 days (259 200 000 ms); never = forever; pairing success = never.
- Deep-link fallback after 2 500 ms while the page stays visible.
- Split button radii 12/4 and 4/12, ▾ 48px; dialog radius 28px, max-width 360px; hero 170px.
- Copy (Dutch) exactly as in the spec.
- Independent of the mobile shell; if `src/hooks/back-entry.hook.ts` exists (mobile shell plan 1 merged), use `useBackEntry('android-promo', open, later)`; otherwise skip that line.
- Run tests with `npx --yes bun test <path>`; type-check `npx tsc -b`; lint `npm run lint`.
- Branch `feat/android-promo` in its own worktree.

---

### Task 0: Worktree

- [ ] **Step 1**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
git worktree add ../.worktrees/client-android-promo -b feat/android-promo main
cd ../.worktrees/client-android-promo && npm ci && npx --yes bun test 2>&1 | tail -3
```

Expected: baseline green.

---

### Task 1: Decision + storage logic

**Files:**
- Create: `src/lib/android-promo.ts`, `src/lib/android-promo.test.ts`

**Interfaces:**
- Produces: `PROMO_STORAGE_KEY`, `LATER_MS`, `APP_OPEN_TIMEOUT_MS`, `type PromoState = { hiddenUntil?: number; never?: true }`, `isAndroidUserAgent(ua: string): boolean`, `readPromoState(storage: Pick<Storage, 'getItem'>): PromoState`, `writePromoState(storage: Pick<Storage, 'setItem'>, state: PromoState): void`, `laterState(now: number): PromoState`, `shouldShowAndroidPromo(input: PromoInput): boolean` with `PromoInput = { isMobile: boolean; isAndroid: boolean; hasRelease: boolean; paired: boolean; installed: boolean; state: PromoState; now: number }`, `appDidNotOpen(startedAt: number, now: number, visible: boolean): boolean`.

- [ ] **Step 1: Failing test**

```ts
// src/lib/android-promo.test.ts
import { describe, expect, test } from 'bun:test';
import { appDidNotOpen, isAndroidUserAgent, laterState, LATER_MS, readPromoState, shouldShowAndroidPromo, writePromoState } from './android-promo';

const base = { isMobile: true, isAndroid: true, hasRelease: true, paired: false, installed: false, state: {}, now: 1_000_000 };

describe('isAndroidUserAgent', () => {
  test('Android Chrome', () => expect(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36')).toBe(true));
  test('iPhone', () => expect(isAndroidUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1')).toBe(false));
  test('desktop', () => expect(isAndroidUserAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/141')).toBe(false));
});

describe('shouldShowAndroidPromo', () => {
  test('all conditions met', () => expect(shouldShowAndroidPromo(base)).toBe(true));
  test.each([
    ['not mobile', { isMobile: false }],
    ['not Android', { isAndroid: false }],
    ['no APK on the server', { hasRelease: false }],
    ['already paired', { paired: true }],
    ['app detected as installed', { installed: true }],
    ['never again', { state: { never: true as const } }],
  ])('hidden when %s', (_, patch) => expect(shouldShowAndroidPromo({ ...base, ...patch })).toBe(false));
  test('"Later" hides for 3 days', () => {
    const state = laterState(base.now);
    expect(shouldShowAndroidPromo({ ...base, state, now: base.now + LATER_MS - 1 })).toBe(false);
    expect(shouldShowAndroidPromo({ ...base, state, now: base.now + LATER_MS })).toBe(true);
  });
});

describe('storage', () => {
  test('round trip', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    writePromoState(storage, { never: true });
    expect(readPromoState(storage)).toEqual({ never: true });
  });
  test('missing or corrupt → empty state', () => {
    expect(readPromoState({ getItem: () => null })).toEqual({});
    expect(readPromoState({ getItem: () => '{oops' })).toEqual({});
    expect(readPromoState({ getItem: () => '"text"' })).toEqual({});
  });
});

describe('appDidNotOpen', () => {
  test('page still visible after 2.5 s → the app did not open', () => expect(appDidNotOpen(0, 2500, true)).toBe(true));
  test('too early', () => expect(appDidNotOpen(0, 2000, true)).toBe(false));
  test('page hidden (the app took over)', () => expect(appDidNotOpen(0, 9000, false)).toBe(false));
});
```

- [ ] **Step 2: Run** — `npx --yes bun test src/lib/android-promo.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/android-promo.ts
/** One-time "there's an Android app" popup: who sees it and when (see the android-app-promo spec). */
export const PROMO_STORAGE_KEY = 'jh-android-promo';
export const LATER_MS = 3 * 24 * 60 * 60 * 1000;
/** The deep link opens the app within this time; still on the page after it = the app isn't installed. */
export const APP_OPEN_TIMEOUT_MS = 2500;

export type PromoState = { hiddenUntil?: number; never?: true };

export interface PromoInput {
  isMobile: boolean;
  isAndroid: boolean;
  hasRelease: boolean;
  paired: boolean;
  installed: boolean;
  state: PromoState;
  now: number;
}

export function isAndroidUserAgent(ua: string): boolean {
  return /Android/i.test(ua);
}

export function readPromoState(storage: Pick<Storage, 'getItem'>): PromoState {
  try {
    const value: unknown = JSON.parse(storage.getItem(PROMO_STORAGE_KEY) ?? '{}');
    if (!value || typeof value !== 'object') return {};
    const { hiddenUntil, never } = value as Record<string, unknown>;
    return { ...(typeof hiddenUntil === 'number' ? { hiddenUntil } : {}), ...(never === true ? { never: true as const } : {}) };
  } catch {
    return {};
  }
}

export function writePromoState(storage: Pick<Storage, 'setItem'>, state: PromoState): void {
  storage.setItem(PROMO_STORAGE_KEY, JSON.stringify(state));
}

export function laterState(now: number): PromoState {
  return { hiddenUntil: now + LATER_MS };
}

export function shouldShowAndroidPromo({ isMobile, isAndroid, hasRelease, paired, installed, state, now }: PromoInput): boolean {
  if (!isMobile || !isAndroid || !hasRelease || paired || installed || state.never) return false;
  return state.hiddenUntil === undefined || now >= state.hiddenUntil;
}

export function appDidNotOpen(startedAt: number, now: number, visible: boolean): boolean {
  return visible && now - startedAt >= APP_OPEN_TIMEOUT_MS;
}
```

- [ ] **Step 4: Run** — `npx --yes bun test src/lib/android-promo.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/android-promo.ts src/lib/android-promo.test.ts
git commit -m "feat(android-promo): show/hide logic and storage"
```

---

### Task 2: Store + auto-open hook + manifest

**Files:**
- Create: `src/stores/android-promo.store.ts`, `src/hooks/android-promo.hook.ts`
- Modify: `vite.config.ts` (PWA `manifest` object)

**Interfaces:**
- Consumes: Task 1; `useIsMobile`, `useAppRelease` (`@/hooks/app-pairing.hook`), `useAccount(enabled)` (`@/hooks/account.hook`, returns `{ account: AccountOverview | undefined, … }`), `useTourStore` (`@/components/tour/tour.store`), `useNotificationsDialogStore`, `useAccountDialogStore`.
- Produces: `useAndroidPromoStore` `{ open: boolean; step: PromoStep; setStep(step): void; show(): void; close(result: 'later' | 'never' | 'paired' | 'dismiss'): void }` with `type PromoStep = 'intro' | 'download' | 'install' | 'pair' | 'done'`; hook `useAndroidPromoAutoOpen(): void`.

- [ ] **Step 1: Store**

```ts
// src/stores/android-promo.store.ts
import { create } from 'zustand';
import { laterState, writePromoState } from '@/lib/android-promo';

export type PromoStep = 'intro' | 'download' | 'install' | 'pair' | 'done';
export type PromoClose = 'later' | 'never' | 'paired' | 'dismiss';

interface AndroidPromoState {
  open: boolean;
  step: PromoStep;
  setStep: (step: PromoStep) => void;
  /** Open at the intro (auto-open and the menu row) */
  show: () => void;
  /** Close and remember why: later = 3 days, never/paired = forever, dismiss = nothing stored */
  close: (result: PromoClose) => void;
}

const useAndroidPromoStore = create<AndroidPromoState>()((set) => ({
  open: false,
  step: 'intro',
  setStep: (step) => set({ step }),
  show: () => set({ open: true, step: 'intro' }),
  close: (result) => {
    if (result === 'later') writePromoState(localStorage, laterState(Date.now()));
    if (result === 'never' || result === 'paired') writePromoState(localStorage, { never: true });
    set({ open: false });
  },
}));

export default useAndroidPromoStore;
```

- [ ] **Step 2: Hook**

```ts
// src/hooks/android-promo.hook.ts
import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/media.hook';
import { useAppRelease } from '@/hooks/app-pairing.hook';
import { useAccount } from '@/hooks/account.hook';
import useTourStore from '@/components/tour/tour.store';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import useAccountDialogStore from '@/stores/account-dialog.store';
import useAndroidPromoStore from '@/stores/android-promo.store';
import { isAndroidUserAgent, readPromoState, shouldShowAndroidPromo } from '@/lib/android-promo';

const APP_ID = 'nl.jotihunt.tracker';
const OPEN_DELAY_MS = 1500;

type RelatedApp = { id?: string };
type NavigatorWithRelated = Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> };

/** Opens the Android-app popup once per session when every condition in the spec holds. */
export function useAndroidPromoAutoOpen() {
  const isMobile = useIsMobile();
  const isAndroid = isAndroidUserAgent(navigator.userAgent);
  const relevant = isMobile && isAndroid;
  const { release } = useAppRelease();
  const { account: overview } = useAccount(relevant);
  const [installed, setInstalled] = useState<boolean | undefined>(undefined);
  const tourActive = useTourStore((s) => s.active);
  const meldingenOpen = useNotificationsDialogStore((s) => s.open);
  const accountOpen = useAccountDialogStore((s) => s.open);
  const opened = useRef(false);

  useEffect(() => {
    if (!relevant) return;
    const nav = navigator as NavigatorWithRelated;
    if (!nav.getInstalledRelatedApps) {
      setInstalled(false);
      return;
    }
    nav
      .getInstalledRelatedApps()
      .then((apps) => setInstalled(apps.some((app) => app.id === APP_ID)))
      .catch(() => setInstalled(false));
  }, [relevant]);

  const ready = release !== undefined && overview !== undefined && installed !== undefined;
  const busy = tourActive || meldingenOpen || accountOpen;

  useEffect(() => {
    if (opened.current || !ready || busy) return;
    const show = shouldShowAndroidPromo({
      isMobile,
      isAndroid,
      hasRelease: !!release,
      paired: (overview?.devices.length ?? 0) > 0,
      installed: !!installed,
      state: readPromoState(localStorage),
      now: Date.now(),
    });
    if (!show) return;
    const id = window.setTimeout(() => {
      opened.current = true;
      useAndroidPromoStore.getState().show();
    }, OPEN_DELAY_MS);
    return () => clearTimeout(id);
  }, [ready, busy, isMobile, isAndroid, release, overview, installed]);
}
```


- [ ] **Step 3: Manifest** — in `vite.config.ts`, inside `manifest: { … }` after `description`, add:

```ts
    // Lets Chrome's getInstalledRelatedApps() see the Android app (the APK also needs an asset statement for this site)
    related_applications: [{ platform: 'play', id: 'nl.jotihunt.tracker' }],
    prefer_related_applications: false,
```

- [ ] **Step 4: Verify + commit**

```bash
npx tsc -b && npm run lint
git add src/stores/android-promo.store.ts src/hooks/android-promo.hook.ts vite.config.ts
git commit -m "feat(android-promo): store, auto-open hook and related app"
```

---

### Task 3: Hero + split button

**Files:**
- Create: `src/components/android-promo/AndroidPromoHero.tsx`, `src/components/android-promo/DownloadSplitButton.tsx`

**Interfaces:**
- Consumes: `useMarkerPalette` (`@/components/layers/marker-icons`) for tertiaryContainer / container colours, `GLYPHS` (`@/components/layers/marker-glyphs`).
- Produces: `<AndroidPromoHero onClose={() => void} />`; `<DownloadSplitButton version={string} onDownload={() => void} onLater={() => void} onNever={() => void} />`.

- [ ] **Step 1: Hero**

```tsx
// src/components/android-promo/AndroidPromoHero.tsx
import { XIcon } from 'lucide-react';
import { useMarkerPalette } from '@/components/layers/marker-icons';

const BAR = ['ok', 'ok', 'warn', 'ok', 'error', 'ok'] as const;

/** Illustration: a tilted phone running the app (map, vossen widget, floating toolbar) and a vossen home-screen widget. */
export default function AndroidPromoHero({ onClose }: { onClose: () => void }) {
  const p = useMarkerPalette();
  const fill = { ok: p.okContainer, warn: p.warnContainer, error: p.errorContainer };
  return (
    <div className="relative h-[170px] overflow-hidden" style={{ background: `radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--primary) 35%, transparent), transparent 60%), ${p.tertiaryContainer}` }}>
      <button type="button" aria-label="Later" onClick={onClose} className="absolute right-2.5 top-2.5 z-10 grid size-[34px] place-items-center rounded-full bg-black/25 text-white">
        <XIcon className="size-5" />
      </button>
      <div className="absolute bottom-[-40px] left-1/2 h-[200px] w-[130px] -translate-x-1/2 -rotate-6 overflow-hidden rounded-[22px] bg-muted shadow-[0_0_0_5px_#111,0_14px_30px_rgb(0_0_0/.4)]" aria-hidden>
        <span className="absolute left-10 top-10 size-[22px] rounded-lg" style={{ background: p.okContainer, boxShadow: `0 0 0 2px ${p.surfaceContainerLowest}` }} />
        <span className="absolute left-20 top-20 size-[22px] rounded-full bg-primary" style={{ boxShadow: `0 0 0 2px ${p.surfaceContainerLowest}` }} />
        <div className="absolute inset-x-2 bottom-[46px] h-11 rounded-[14px] bg-card p-[7px]">
          <div className="flex gap-0.5">
            {BAR.map((k, i) => (
              <i key={i} className="h-1.5 flex-1 rounded-sm" style={{ background: fill[k] }} />
            ))}
          </div>
          <div className="mt-[5px] text-[8px] font-bold">41 km vandaag</div>
        </div>
        <div className="absolute inset-x-[22px] bottom-3 h-[26px] rounded-[13px] bg-card" />
      </div>
      <div className="absolute left-[18px] top-[22px] size-[90px] rotate-[8deg] rounded-[22px] bg-card p-2.5 shadow-[0_10px_24px_rgb(0_0_0/.3)]" aria-hidden>
        <div className="text-[9px] font-extrabold text-muted-foreground">VOSSEN</div>
        <div className="mt-1.5 grid grid-cols-3 gap-[3px]">
          {(['ok', 'ok', 'warn', 'ok', 'warn', 'ok'] as const).map((k, i) => (
            <i key={i} className="h-4 rounded-[5px]" style={{ background: fill[k] }} />
          ))}
        </div>
      </div>
    </div>
  );
}
```


- [ ] **Step 2: Split button**

```tsx
// src/components/android-promo/DownloadSplitButton.tsx
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronUpIcon, ClockIcon, DownloadIcon, EyeOffIcon } from 'lucide-react';
import { EASE_OUT } from '@/lib/motion';

/** M3 Expressive split button: Download, with ▾ for "Later herinneren" / "Niet meer tonen". */
export default function DownloadSplitButton({ version, onDownload, onLater, onNever }: { version: string; onDownload: () => void; onLater: () => void; onNever: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => !ref.current?.contains(event.target as Node) && setMenuOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  return (
    <div ref={ref} className="relative flex gap-0.5">
      <button type="button" onClick={onDownload} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-l-xl rounded-r-[4px] bg-primary text-[14.5px] font-semibold text-primary-foreground active:scale-[.98]">
        <DownloadIcon className="size-5" /> Download · {version}
      </button>
      <motion.button
        type="button"
        aria-label="Meer opties"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        animate={{ borderRadius: menuOpen ? 24 : '4px 12px 12px 4px' }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="grid h-12 w-12 place-items-center bg-primary text-primary-foreground"
      >
        <motion.span animate={{ rotate: menuOpen ? 0 : 180 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
          <ChevronUpIcon className="size-5" />
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            style={{ transformOrigin: 'bottom right' }}
            className="absolute bottom-[54px] right-0 min-w-[190px] rounded-2xl bg-card p-1.5 shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/.5)]"
          >
            <button type="button" role="menuitem" onClick={onLater} className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13.5px] font-semibold hover:bg-beheer-row-high">
              <ClockIcon className="size-5" /> Later herinneren
            </button>
            <button type="button" role="menuitem" onClick={onNever} className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13.5px] font-semibold hover:bg-beheer-row-high">
              <EyeOffIcon className="size-5" /> Niet meer tonen
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
npx tsc -b && npm run lint
git add src/components/android-promo
git commit -m "feat(android-promo): hero illustration and split button"
```

---

### Task 4: Steps + dialog + mount

**Files:**
- Create: `src/components/android-promo/PromoSteps.tsx`, `src/components/android-promo/AndroidPromoDialog.tsx`
- Modify: `src/Layout.tsx` (mount next to `<AccountDialog/>`, call `useAndroidPromoAutoOpen()` in the Layout component body)

**Interfaces:**
- Consumes: Tasks 1–3; `useAppRelease`, `usePairingCode` (`@/hooks/app-pairing.hook`), `useTrackerStatus`, `absoluteUrl`, `buildPairingUrl` (`@/lib/app-pairing`), `cookiePath`, `BADGE_COOKIE_DEPTH`, `SWAP` (`@/lib/motion`).
- Produces: `<AndroidPromoDialog />`.

- [ ] **Step 1: Steps**

```tsx
// src/components/android-promo/PromoSteps.tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { LinkIcon, TriangleAlertIcon } from 'lucide-react';
import { cookiePath, BADGE_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { appDidNotOpen } from '@/lib/android-promo';
import { POP_SPRING } from '@/lib/motion';
import type { PromoStep } from '@/stores/android-promo.store';
import { cn } from '@/lib/utils';

const CHECK = cookiePath(72, BADGE_COOKIE_DEPTH);
const STEP_INDEX: Partial<Record<PromoStep, number>> = { download: 0, install: 1, pair: 2 };

export function Stepper({ step }: { step: PromoStep }) {
  const index = STEP_INDEX[step] ?? -1;
  return (
    <div className="mb-3.5 flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <i key={i} className={cn('h-1 flex-1 rounded-sm transition-colors duration-300', i <= index ? 'bg-primary' : 'bg-beheer-row-high')} />
      ))}
    </div>
  );
}

export function DownloadingStep({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 1200);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="size-[22px] animate-spin rounded-full border-[3px] border-beheer-row-high border-t-primary" />
      <b>Downloaden…</b>
    </div>
  );
}

export function InstallStep({ onPair, onRedownload }: { onPair: () => void; onRedownload: () => void }) {
  return (
    <>
      <b className="block text-[17px]">Installeer de app</b>
      <p className="mb-3 mt-1 text-[13.5px] text-muted-foreground">
        Tik op de download-melding en dan op <b className="text-foreground">Installeren</b>.
      </p>
      <div className="flex gap-2.5 rounded-[14px] bg-[color-mix(in_oklab,#f59e0b_16%,var(--card))] px-3 py-2.5 text-[12.5px]">
        <TriangleAlertIcon className="size-5 shrink-0 text-amber-500" />
        <div>
          Vraagt Android om toestemming? Kies <b>Instellingen → Toestaan van deze bron</b> voor Chrome, en ga terug.
        </div>
      </div>
      <div className="mt-3.5 flex flex-col gap-2">
        <button type="button" onClick={onPair} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
          <LinkIcon className="size-5" /> Geïnstalleerd, koppel nu
        </button>
        <button type="button" onClick={onRedownload} className="h-10 rounded-xl text-[13.5px] font-semibold text-muted-foreground">
          Opnieuw downloaden
        </button>
      </div>
    </>
  );
}

/**
 * Opens the app via the pairing deep link (`openApp` creates the code and navigates), then waits for the tracker
 * to connect. Still visible after 2.5 s = the app didn't open.
 */
export function PairStep({ openApp, connected, onConnected, onBack }: { openApp: () => Promise<boolean>; connected: boolean; onConnected: () => void; onBack: () => void }) {
  const [phase, setPhase] = useState<'opening' | 'waiting' | 'failed'>('opening');
  const startedAt = useRef(0);
  const attempt = async () => {
    setPhase('opening');
    startedAt.current = Date.now();
    if (!(await openApp())) setPhase('failed');
  };
  useEffect(() => {
    void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (connected) onConnected();
  }, [connected, onConnected]);
  useEffect(() => {
    if (phase !== 'opening') return;
    const id = window.setInterval(() => {
      if (appDidNotOpen(startedAt.current, Date.now(), document.visibilityState === 'visible')) setPhase('failed');
    }, 250);
    const onVisible = () => document.visibilityState === 'visible' && setPhase('waiting');
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase]);

  if (phase === 'failed') {
    return (
      <div className="flex flex-col gap-2 py-2 text-center">
        <b>App ging niet open?</b>
        <span className="text-[13px] text-muted-foreground">Installeer hem eerst.</span>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onBack} className="h-11 flex-1 rounded-xl bg-beheer-row-high font-semibold">Terug</button>
          <button type="button" onClick={() => void attempt()} className="h-11 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground">Opnieuw proberen</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <span className="size-[22px] animate-spin rounded-full border-[3px] border-beheer-row-high border-t-primary" />
      <b>{phase === 'opening' ? 'App openen…' : 'Wachten op de app…'}</b>
      <span className="text-[12.5px] text-muted-foreground">De app opent vanzelf</span>
      {phase === 'waiting' && (
        <button type="button" onClick={() => void attempt()} className="h-10 rounded-xl px-4 text-[13.5px] font-semibold text-muted-foreground">
          Opnieuw proberen
        </button>
      )}
    </div>
  );
}

export function DoneStep({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="flex flex-col items-center gap-1 pt-1.5 text-center">
        <motion.svg width="72" height="72" viewBox="0 0 72 72" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={POP_SPRING} aria-hidden>
          <path d={CHECK} fill="#22c55e" />
          <path d="M22.3 36.7L31.7 46.1L49.7 27.4" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
        <b className="mt-2 text-lg">Gekoppeld!</b>
        <span className="text-[13px] text-muted-foreground">Je tracker staat nu in de app · live</span>
      </div>
      <button type="button" onClick={onClose} className="mt-3.5 h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">
        Klaar
      </button>
    </>
  );
}
```

- [ ] **Step 2: Dialog**

```tsx
// src/components/android-promo/AndroidPromoDialog.tsx
import { useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BellIcon, CarIcon, LayoutGridIcon, MapPinIcon } from 'lucide-react';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import { useAppRelease, usePairingCode } from '@/hooks/app-pairing.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { absoluteUrl, buildPairingUrl } from '@/lib/app-pairing';
import { SWAP } from '@/lib/motion';
import useAndroidPromoStore from '@/stores/android-promo.store';
import AndroidPromoHero from './AndroidPromoHero';
import DownloadSplitButton from './DownloadSplitButton';
import { DoneStep, DownloadingStep, InstallStep, PairStep, Stepper } from './PromoSteps';

const apiBase: string = import.meta.env.API_BASE_URL;

/** The one-time Android-app popup (design B + split button), see the android-app-promo spec. */
export default function AndroidPromoDialog() {
  const { open, step, setStep, close } = useAndroidPromoStore();
  const { release } = useAppRelease();
  const { status } = useTrackerStatus();
  const { create } = usePairingCode();
  const connected = !!status?.configured && status.connected;

  const download = useCallback(() => {
    if (!release) return;
    const a = document.createElement('a');
    a.href = absoluteUrl(apiBase, release.url, window.location.origin);
    a.download = '';
    a.click();
    setStep('download');
  }, [release, setStep]);

  const openApp = useCallback(async () => {
    const pairing = await create();
    if (!pairing) return false;
    window.location.href = buildPairingUrl(apiBase, pairing.code, window.location.origin);
    return true;
  }, [create]);

  return (
    <AnimatePresence>
      {open && release && (
        <>
          <motion.div key="scrim" className="fixed inset-0 z-50 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => step === 'intro' && close('later')} />
          <motion.div
            key="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Android-app"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[360px] overflow-hidden rounded-[28px] bg-beheer-window"
            initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-46%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-48%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} {...SWAP}>
                {step === 'intro' ? (
                  <>
                    <AndroidPromoHero onClose={() => close('later')} />
                    <div className="px-5 pb-4 pt-[18px]">
                      <b className="block text-xl leading-tight">De Jotihunt-app voor Android</b>
                      <p className="mb-3 mt-1.5 text-[13.5px] text-muted-foreground">Je telefoon als tracker, ook als het scherm uit is.</p>
                      <FeatureChips />
                      <DownloadSplitButton version={release.versionName} onDownload={download} onLater={() => close('later')} onNever={() => close('never')} />
                    </div>
                  </>
                ) : (
                  <div className="p-5">
                    {step !== 'done' && <Stepper step={step} />}
                    {step === 'download' && <DownloadingStep onDone={() => setStep('install')} />}
                    {step === 'install' && <InstallStep onPair={() => setStep('pair')} onRedownload={download} />}
                    {step === 'pair' && <PairStep openApp={openApp} connected={connected} onConnected={() => setStep('done')} onBack={() => setStep('install')} />}
                    {step === 'done' && <DoneStep onClose={() => close('paired')} />}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

Add the chips component at the bottom of the same file:

```tsx
function FeatureChips() {
  const p = useMarkerPalette();
  const chips = [
    { icon: MapPinIcon, label: 'Achtergrond-tracker', bg: p.secondaryContainer, fg: p.onSecondaryContainer },
    { icon: BellIcon, label: 'Meldingen', bg: p.warnContainer, fg: p.onWarnContainer },
    { icon: LayoutGridIcon, label: 'Widgets', bg: p.tertiaryContainer, fg: p.onTertiaryContainer },
    { icon: CarIcon, label: 'Android Auto', bg: p.primaryContainer, fg: p.onPrimaryContainer },
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {chips.map(({ icon: Icon, label, bg, fg }) => (
        <span key={label} className="inline-flex h-8 items-center gap-1.5 rounded-full pl-2 pr-3 text-[12.5px] font-semibold" style={{ background: bg, color: fg }}>
          <Icon className="size-4" /> {label}
        </span>
      ))}
    </div>
  );
}
```

`usePairingCode().create()` currently returns `void` and stores the code in state. Change it to also **return** the created `PairingCode` (or `null` on failure) in `src/hooks/app-pairing.hook.ts`:

```ts
  async function create(): Promise<PairingCode | null> {
    setCreating(true);
    setFailed(false);
    try {
      const response = await fetch<PairingCode>('/tracker/pair', 'POST');
      setPairing(response.data);
      return response.data;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setCreating(false);
    }
  }
```

(Existing callers ignore the return value, so they keep working.)

If `src/hooks/back-entry.hook.ts` exists, add `useBackEntry('android-promo', open, () => close(step === 'done' ? 'paired' : 'later'));` at the top of `AndroidPromoDialog`.

- [ ] **Step 3: Mount** — in `src/Layout.tsx` import `AndroidPromoDialog` and `useAndroidPromoAutoOpen`; call `useAndroidPromoAutoOpen();` in the component body and render `<AndroidPromoDialog/>` after `<AccountDialog/>` inside the "Dit venster" ErrorBoundary.

- [ ] **Step 4: Verify**

```bash
npx --yes bun test && npx tsc -b && npm run lint
```

Manual (Chrome DevTools, device "Pixel 7", which sends an Android UA; log in with a user without app devices; clear `jh-android-promo`): popup opens after ~1.5 s; X / scrim / "Later herinneren" close it and a reload keeps it closed (3 days); "Niet meer tonen" keeps it closed for good; Download starts the APK download and moves to "Installeer de app"; "Geïnstalleerd, koppel nu" tries `jotihunt://pair…` and after 2.5 s shows "App ging niet open?"; split ▾ morphs to a circle and opens the menu. On a real Android phone with the app installed: pairing reaches "Gekoppeld!".

- [ ] **Step 5: Commit**

```bash
git add src/components/android-promo src/hooks/app-pairing.hook.ts src/Layout.tsx
git commit -m "feat(android-promo): dialog with download, install and pair steps"
```
