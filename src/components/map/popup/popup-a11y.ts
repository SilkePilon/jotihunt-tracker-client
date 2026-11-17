import { createContext, useContext, useEffect, type RefObject } from 'react';
import { clearPopupFocusRequest } from '@/lib/popup-focus';
import usePopupAnnouncementStore from '@/stores/popup-announcement.store';

/** The id of the open popup's title (PopupHeader's h2), which labels the popup's dialog role. */
export const PopupTitleIdContext = createContext<string | undefined>(undefined);

export function usePopupTitleId() {
  return useContext(PopupTitleIdContext);
}

/**
 * Announce "<titel> geopend" once the popup (or, on phones, the dock) is there, and clear it on close so the same popup
 * opening again is read out again. Only on open: live titles (hunters, Life360) change on every update.
 */
export function useAnnouncePopup(dialog: RefObject<HTMLElement | null>, ready: unknown) {
  useEffect(() => {
    if (!ready) return;
    const { announce, clear } = usePopupAnnouncementStore.getState();
    announce(dialog.current?.querySelector('h2')?.textContent);
    return clear;
  }, [dialog, ready]);
}

/** How long after mounting a focused popup takes focus back from a closing menu/dialog that returns it to its trigger. */
const FOCUS_GRACE_MS = 1200;

/**
 * A popup opened from a list with the keyboard (see openLayerFeature's `focus`) takes focus once mounted, so Tab and
 * Escape work in it. A menu or dialog that opened it may hand focus back to its trigger while it closes: until the
 * user presses a key or the pointer, the popup takes it back and `setOpener` remembers that trigger (focus returns
 * there when the popup closes).
 */
export function useTakePopupFocus(dialog: RefObject<HTMLElement | null>, ready: unknown, take: boolean, setOpener: (element: HTMLElement) => void) {
  useEffect(() => {
    if (!take || !ready) return;
    clearPopupFocusRequest();
    const node = dialog.current;
    if (!node) return;
    const focus = () => node.focus({ preventScroll: true });
    let settled = false;
    const settle = () => (settled = true);
    const onFocusIn = (event: FocusEvent) => {
      if (settled || !(event.target instanceof HTMLElement) || node.contains(event.target) || !node.isConnected) return;
      setOpener(event.target);
      focus();
    };
    // A frame later: a menu that was just selected from stops trapping focus first
    const frame = requestAnimationFrame(focus);
    const timeout = setTimeout(settle, FOCUS_GRACE_MS);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', settle, true);
    document.addEventListener('pointerdown', settle, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', settle, true);
      document.removeEventListener('pointerdown', settle, true);
    };
  }, [dialog, ready, take, setOpener]);
}
