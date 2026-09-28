/**
 * Downscale a photo to at most `maxSide` px on the long side and re-encode it as JPEG (quality 0.8).
 * Phone photos are 3–8 MB; this keeps uploads around 300 KB on a bad connection and speeds up OCR.
 * Uses the EXIF orientation (createImageBitmap `imageOrientation: 'from-image'`).
 */
export async function downscalePhoto(file: Blob, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Foto verkleinen mislukt'))), 'image/jpeg', 0.8));
}

const GRID_CELL_PX = 8;
/** A cell is "paper" when enough of its samples are bright and colourless (the white hunt sticker). */
const PAPER_MIN_CHANNEL = 150;
const PAPER_MAX_SATURATION = 45;
const PAPER_MIN_SAMPLES = 10;
/** Ignore "stickers" smaller than this share of the photo (noise, reflections). */
const MIN_STICKER_SHARE = 0.01;

/**
 * Find the white hunt sticker in a photo (largest connected area of bright, colourless pixels on an 8 px grid) and
 * return it cropped and scaled to `targetWidth` px wide, or null when no sticker-like area is found.
 * OCR on the enlarged sticker reads upper/lower case and look-alike characters much better than on the whole photo.
 */
export async function cropSticker(photo: Blob, targetWidth: number): Promise<HTMLCanvasElement | null> {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  const base = document.createElement('canvas');
  base.width = bitmap.width;
  base.height = bitmap.height;
  const context = base.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = context.getImageData(0, 0, base.width, base.height);
  const gridWidth = Math.floor(base.width / GRID_CELL_PX);
  const gridHeight = Math.floor(base.height / GRID_CELL_PX);
  const paper = new Uint8Array(gridWidth * gridHeight);
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      let bright = 0;
      for (let y = 0; y < GRID_CELL_PX; y += 2) {
        for (let x = 0; x < GRID_CELL_PX; x += 2) {
          const i = ((gy * GRID_CELL_PX + y) * base.width + gx * GRID_CELL_PX + x) * 4;
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          if (min > PAPER_MIN_CHANNEL && max - min < PAPER_MAX_SATURATION) bright++;
        }
      }
      paper[gy * gridWidth + gx] = bright >= PAPER_MIN_SAMPLES ? 1 : 0;
    }
  }

  // Largest 4-connected paper area
  const seen = new Uint8Array(paper.length);
  let best: { size: number; x0: number; y0: number; x1: number; y1: number } | null = null;
  for (let start = 0; start < paper.length; start++) {
    if (!paper[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    const area = { size: 0, x0: gridWidth, y0: gridHeight, x1: 0, y1: 0 };
    while (stack.length) {
      const cell = stack.pop()!;
      const x = cell % gridWidth;
      const y = Math.floor(cell / gridWidth);
      area.size++;
      area.x0 = Math.min(area.x0, x);
      area.x1 = Math.max(area.x1, x);
      area.y0 = Math.min(area.y0, y);
      area.y1 = Math.max(area.y1, y);
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
        const next = ny * gridWidth + nx;
        if (paper[next] && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    if (!best || area.size > best.size) best = area;
  }
  if (!best || best.size < paper.length * MIN_STICKER_SHARE) return null;

  const sx = best.x0 * GRID_CELL_PX;
  const sy = best.y0 * GRID_CELL_PX;
  const sw = (best.x1 - best.x0 + 1) * GRID_CELL_PX;
  const sh = (best.y1 - best.y0 + 1) * GRID_CELL_PX;
  const scale = targetWidth / sw;
  const crop = document.createElement('canvas');
  crop.width = Math.round(sw * scale);
  crop.height = Math.round(sh * scale);
  const cropContext = crop.getContext('2d')!;
  cropContext.imageSmoothingQuality = 'high';
  cropContext.drawImage(base, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
  return crop;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Afbeelding maken mislukt'))), 'image/jpeg', 0.9));
}
