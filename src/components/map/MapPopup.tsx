import type { ReactNode } from 'react';
import type { PositionAnchor } from 'maplibre-gl';
import { Popup, type PopupProps } from 'react-map-gl/maplibre';
import DockedPopup from '@/components/mobile/DockedPopup';
import { useIsMobile } from '@/hooks/media.hook';

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
  if (isMobile) {
    return (
      <DockedPopup longitude={longitude} latitude={latitude} onClose={onClose}>
        {children}
      </DockedPopup>
    );
  }
  return (
    <Popup
      anchor="bottom"
      longitude={longitude}
      latitude={latitude}
      onClose={onClose}
      closeOnClick={true}
      offset={offset as PopupProps['offset']}
      maxWidth="248px"
      className="z-20"
    >
      <div className="flex w-[220px] flex-col">{children}</div>
    </Popup>
  );
}
