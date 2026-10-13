import MapTooltip from '@/components/map/MapTooltip';
import { useNow } from '@/hooks/now.hook';
import { formatAgeShort } from '@/lib/life360';
import { isMoreThanFiveMinutesAgo } from '@/lib/utils';
import type { Position } from '@/types/Position';
import { useMarkerPalette } from '../marker-icons';

// Above the hovered hunter (38px circle, centred)
const TOOLTIP_OFFSET: [number, number] = [0, -30];

/** Hover tooltip of a hunter: name and how long ago (grey dot when stale); follows every poll. */
export default function DeviceTooltip({ position }: { position: Position }) {
  const palette = useMarkerPalette();
  const now = useNow(true);
  const stale = isMoreThanFiveMinutesAgo(position.fixTime);
  return (
    <MapTooltip
      longitude={position.longitude}
      latitude={position.latitude}
      offset={TOOLTIP_OFFSET}
      color={stale ? 'var(--map-muted)' : palette.onSecondaryContainer}
      title={position.deviceName}
      meta={formatAgeShort(position.fixTime, now)}
    />
  );
}
