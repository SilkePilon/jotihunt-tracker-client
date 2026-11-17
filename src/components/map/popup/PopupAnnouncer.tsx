import usePopupAnnouncementStore from '@/stores/popup-announcement.store';

/** The permanent, visually hidden live region the announcements go to; mounted once next to the map. */
export default function PopupAnnouncer() {
  const text = usePopupAnnouncementStore((state) => state.text);
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {text}
    </div>
  );
}
