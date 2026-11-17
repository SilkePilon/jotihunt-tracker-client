import { create } from 'zustand';
import { popupAnnouncement } from '@/lib/popup-announcement';

interface PopupAnnouncementStore {
  /** The live region's text; '' between popups so reopening the same one is read out again */
  text: string;
  announce: (title: string | null | undefined) => void;
  clear: () => void;
}

/** "<titel> geopend" for the map's permanent live region (PopupAnnouncer), set when a map popup opens. Not persisted. */
const usePopupAnnouncementStore = create<PopupAnnouncementStore>((set) => ({
  text: '',
  announce: (title) => set({ text: popupAnnouncement(title) }),
  clear: () => set({ text: '' }),
}));

export default usePopupAnnouncementStore;
