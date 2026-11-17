/**
 * The HQ wall's "sound on" click survives a reload (an automatic SW update, the edition reloader): a sessionStorage
 * flag remembers it for this tab, so after a reload the wall carries on (wake lock straight away) and only asks for a
 * new click when the browser really blocks sound again.
 */
export const HQ_UNLOCK_KEY = 'hq-audio-unlocked';

/** What the wall shows for sound: the full overlay (never clicked), nothing yet (checking), the "Geluid staat uit" banner (blocked, mode 'tile') or nothing */
export type HqUnlockMode = 'overlay' | 'checking' | 'tile' | 'unlocked';

/** Whether the browser lets this page play sound without a new click: 'unknown' while that is being checked */
export type AudioPermission = 'allowed' | 'blocked' | 'unknown';

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

function sessionStore(): FlagStorage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

/** Whether sound was turned on earlier in this tab (false when storage is unavailable). */
export function readUnlockFlag(storage: FlagStorage | undefined = sessionStore()): boolean {
  try {
    return storage?.getItem(HQ_UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeUnlockFlag(storage: FlagStorage | undefined = sessionStore()): void {
  try {
    storage?.setItem(HQ_UNLOCK_KEY, '1');
  } catch {
    // Private mode / blocked storage: the next reload simply asks again
  }
}

/** The sound state to show: never clicked in this tab gives the full overlay; after a reload only a blocked browser gets the tile. */
export function hqUnlockMode(flag: boolean, audio: AudioPermission): HqUnlockMode {
  if (!flag) return 'overlay';
  if (audio === 'unknown') return 'checking';
  return audio === 'allowed' ? 'unlocked' : 'tile';
}

interface AutoplayNavigator {
  getAutoplayPolicy?: (type: 'mediaelement' | 'audiocontext') => 'allowed' | 'allowed-muted' | 'disallowed';
}
type AudioContextCtor = new () => { state: AudioContextState; close(): Promise<void> };

/**
 * Whether sound can play now without a click: the Autoplay Policy API where the browser has it (Firefox), else a fresh
 * AudioContext, which starts 'running' only when autoplay is allowed (Chrome's media engagement, a kiosk flag) and
 * 'suspended' when a click is needed. No way to tell: blocked, so the tile offers the click.
 */
export function probeAudio(
  nav: AutoplayNavigator | undefined = typeof navigator === 'undefined' ? undefined : (navigator as AutoplayNavigator),
  Context: AudioContextCtor | undefined = typeof AudioContext === 'undefined' ? undefined : AudioContext,
): Exclude<AudioPermission, 'unknown'> {
  try {
    const policy = nav?.getAutoplayPolicy?.('mediaelement');
    if (policy) return policy === 'allowed' ? 'allowed' : 'blocked';
  } catch {
    // Older implementations throw for the string form: fall through to the AudioContext
  }
  if (!Context) return 'blocked';
  try {
    const context = new Context();
    const state = context.state;
    void context.close().catch(() => {});
    return state === 'running' ? 'allowed' : 'blocked';
  } catch {
    return 'blocked';
  }
}

/** Just the part of the HQ director store an update waits on (stores/hq-director.store) */
interface EventCardStore {
  getState: () => { current: unknown };
  subscribe: (listener: (state: { current: unknown }) => void) => () => void;
}

/**
 * The wall's automatic update (main.tsx): run `update` now when no event card is on screen, else once the card (and
 * whatever was queued behind it) has gone, so a reload never cuts an event short. Runs it at most once.
 */
export function updateWhenNoEventCard(store: EventCardStore, update: () => void): void {
  if (store.getState().current === null) {
    update();
    return;
  }
  const unsubscribe = store.subscribe((state) => {
    if (state.current !== null) return;
    unsubscribe();
    update();
  });
}
