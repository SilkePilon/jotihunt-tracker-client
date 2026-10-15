export interface HistoryLike {
  pushState(data: unknown, unused: string): void;
  back(): void;
}

/**
 * Makes the phone's Back button close our own layers (popup, page, raised sheet) before leaving the site.
 * Every open layer owns one history entry. Back → popstate → the newest layer closes. A layer closed from the UI
 * (X, ‹, drag down) removes its entry with history.back() and ignores the popstate that follows.
 * That removal runs through `schedule` (a microtask in the app): a layer that unmounts and remounts under the same
 * key in one commit (switching from one map popup to another) keeps its single entry instead of back() + push.
 */
export function createBackStack(history: HistoryLike, schedule: (fn: () => void) => void = (fn) => fn()) {
  const entries: { key: string; close: () => void; closing?: boolean }[] = [];
  let ownPops = 0;
  return {
    open(key: string, close: () => void) {
      const existing = entries.find((entry) => entry.key === key);
      if (existing) {
        existing.close = close;
        existing.closing = false;
        return;
      }
      entries.push({ key, close });
      history.pushState({ jhBack: key }, '');
    },
    closedByUi(key: string) {
      const entry = entries.find((candidate) => candidate.key === key);
      if (!entry) return;
      entry.closing = true;
      schedule(() => {
        const index = entries.indexOf(entry);
        if (!entry.closing || index < 0) return;
        entries.splice(index, 1);
        ownPops++;
        history.back();
      });
    },
    onPopState() {
      if (ownPops > 0) {
        ownPops--;
        return;
      }
      entries.pop()?.close();
    },
    keys: () => entries.map((entry) => entry.key),
  };
}
