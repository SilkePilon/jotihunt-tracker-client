// Separate from lib/tracker.ts so the qrcode library stays out of chunks that only need the tracker helpers
import { create } from 'qrcode';

/** QR code as one SVG path in module units (1 unit per module, no quiet zone). */
export function qrCodePath(text: string): { size: number; path: string } {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  let path = '';
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) path += `M${col} ${row}h1v1h-1z`;
    }
  }
  return { size: modules.size, path };
}
