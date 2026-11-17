import { createContext, useContext, useEffect, type RefObject } from 'react';
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
