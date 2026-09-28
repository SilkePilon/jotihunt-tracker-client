import { useMemo } from 'react';
import { qrCodePath } from '@/lib/tracker';

const QUIET_ZONE = 2;

/**
 * QR code as inline SVG. Always black on a white tile (also in dark mode): phone cameras
 * scan dark-on-light codes most reliably.
 */
export default function TrackerQrCode({ value, size = 180 }: { value: string; size?: number }) {
  const { size: modules, path } = useMemo(() => qrCodePath(value), [value]);
  const viewBox = `${-QUIET_ZONE} ${-QUIET_ZONE} ${modules + QUIET_ZONE * 2} ${modules + QUIET_ZONE * 2}`;

  return (
    <div className="rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-border" style={{ width: size, height: size }}>
      <svg
        viewBox={viewBox}
        className="size-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label="QR-code voor de Traccar Client-app"
        data-tracker-qr
      >
        <path d={path} fill="#000" />
      </svg>
    </div>
  );
}
