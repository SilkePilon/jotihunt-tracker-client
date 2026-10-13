import type { ReactNode } from 'react';
import type { PositionAnchor } from 'maplibre-gl';
import { Popup, type PopupProps } from 'react-map-gl/maplibre';

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

/** Compact map card (236px, styled in index.css) above a point. */
export default function MapPopup({ longitude, latitude, onClose, offset = defaultOffset, children }: MapPopupProps) {
  return (
    <Popup
      anchor="bottom"
      longitude={longitude}
      latitude={latitude}
      onClose={onClose}
      closeOnClick={true}
      offset={offset as PopupProps['offset']}
      maxWidth="none"
      className="z-20"
    >
      <div className="flex w-[216px] flex-col">{children}</div>
    </Popup>
  );
}
