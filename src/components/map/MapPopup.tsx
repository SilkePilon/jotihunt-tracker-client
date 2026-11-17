import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { PositionAnchor } from 'maplibre-gl';
import { Popup, useMap, type PopupProps } from 'react-map-gl/maplibre';
import DockedPopup from '@/components/mobile/DockedPopup';
import { PopupTitleIdContext, useAnnouncePopup, useTakePopupFocus } from '@/components/map/popup/popup-a11y';
import { CloseButton } from '@/components/ui/close-button';
import { useIsMobile } from '@/hooks/media.hook';
import { useRestoreFocus } from '@/hooks/restore-focus.hook';
import { ownsKey } from '@/lib/focus';
import { popupFocusRequested } from '@/lib/popup-focus';

type OffsetObject = Partial<Record<PositionAnchor, [number, number]>>;

interface MapPopupProps {
  longitude: number;
  latitude: number;
  onClose: () => void;
  children: ReactNode;
  // MapLibre's Offset type requires every anchor key; we only ever set `bottom`, so accept a partial map and cast.
  offset?: number | [number, number] | OffsetObject;
}

const defaultOffset: OffsetObject = { bottom: [0, -45] };

/** Map card (248px, styled in index.css) above a point; on phones docked above the sheet instead. */
export default function MapPopup({ longitude, latitude, onClose, offset = defaultOffset, children }: MapPopupProps) {
  const isMobile = useIsMobile();
  // Labels the popup's dialog role: PopupHeader puts it on its title
  const titleId = useId();
  // Opened from a list with the keyboard: the popup takes focus (decided once, on mount)
  const [takeFocus] = useState(popupFocusRequested);
  return (
    <PopupTitleIdContext.Provider value={titleId}>
      {isMobile ? (
        <DockedPopup longitude={longitude} latitude={latitude} onClose={onClose} titleId={titleId} takeFocus={takeFocus}>
          {children}
        </DockedPopup>
      ) : (
        <FloatingPopup longitude={longitude} latitude={latitude} onClose={onClose} offset={offset} titleId={titleId} takeFocus={takeFocus}>
          {children}
        </FloatingPopup>
      )}
    </PopupTitleIdContext.Provider>
  );
}

/** Desktop: the popup at the point. Escape closes it (when focus is in it, on the map or nowhere); focus then goes back. */
function FloatingPopup({
  longitude,
  latitude,
  onClose,
  offset,
  titleId,
  takeFocus,
  children,
}: Required<Omit<MapPopupProps, 'children'>> & { titleId: string; takeFocus: boolean; children: ReactNode }) {
  const { current: map } = useMap();
  const content = useRef<HTMLDivElement>(null);
  useAnnouncePopup(content, true);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const setOpener = useRestoreFocus(() => map?.getCanvas());
  useTakePopupFocus(content, true, takeFocus, setOpener);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const popup = content.current?.closest('.maplibregl-popup');
      // Not while a menu, dialog or field elsewhere has focus: Escape is theirs
      if (!ownsKey(event, document.body, [popup, map?.getContainer()])) return;
      event.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [map]);

  return (
    <Popup
      anchor="bottom"
      longitude={longitude}
      latitude={latitude}
      onClose={onClose}
      closeOnClick={true}
      closeButton={false}
      offset={offset as PopupProps['offset']}
      maxWidth="248px"
      className="z-20"
    >
      {/* Non-modal: focus stays where it is (the map) unless a keyboard user opened it from a list; tabIndex lets it hold focus */}
      <div ref={content} role="dialog" aria-labelledby={titleId} tabIndex={-1} className="outline-none">
        <CloseButton onClick={onClose} className="absolute top-3 right-3 z-10" />
        <div className="flex w-[220px] flex-col">{children}</div>
      </div>
    </Popup>
  );
}
