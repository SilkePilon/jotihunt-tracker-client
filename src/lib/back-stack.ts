export interface HistoryLike {
  pushState(data: unknown, unused: string): void;
  back(): void;
}

/**
 * Makes the phone's Back button close our own layers (popup, page, raised sheet) before leaving the site.
 * Every open layer owns one history entry. Back → popstate → the newest layer closes. A layer closed from the UI
 * (X, ‹, drag down) removes its entry with history.back() and ignores the popstate that follows.
 */
export function createBackStack(history: HistoryLike) {
  const entries: { key: string; close: () => void }[] = [];
  let ownPops = 0;
  return {
    open(key: string, close: () => void) {
      if (entries.some((entry) => entry.key === key)) return;
      entries.push({ key, close });
      history.pushState({ jhBack: key }, '');
    },
    closedByUi(key: string) {
      const index = entries.findIndex((entry) => entry.key === key);
      if (index < 0) return;
      entries.splice(index, 1);
      ownPops++;
      history.back();
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
