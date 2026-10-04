/**
 * createImageBitmap resize hint that brings the long side to `maxSide`, or null when the image is small enough already.
 * Only one side is given (the browser keeps the aspect ratio): if the browser applies it before the EXIF rotation, the
 * result is merely larger than needed, never distorted; preparePhoto clamps it afterwards.
 */
export function resizeHint(width: number, height: number, maxSide: number): { resizeWidth: number } | { resizeHeight: number } | null {
  if (!(width > 0 && height > 0) || Math.max(width, height) <= maxSide) return null;
  return width >= height ? { resizeWidth: maxSide } : { resizeHeight: maxSide };
}

/** Pixel size as displayed (EXIF orientation applied), from the image header; null when the browser can't tell. */
function displaySize(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const done = (size: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(size);
    };
    image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => done(null);
    image.src = url;
  });
}

/**
 * Decode the photo already scaled down where the browser supports it, so an 8–12 MP phone photo doesn't need a
 * full-size bitmap (~50 MB) on a low-memory phone. Falls back to a full-size decode.
 */
async function decodeScaled(file: Blob, maxSide: number): Promise<ImageBitmap> {
  const size = await displaySize(file).catch(() => null);
  const hint = size && resizeHint(size.width, size.height, maxSide);
  if (hint) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image', resizeQuality: 'high', ...hint });
    } catch {
      // Resize options not supported: decode at full size below
    }
  }
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** Pixel size that brings the long side to at most `maxSide` (never upscaled, at least 1 px). */
export function scaledSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Long side of the list thumbnail uploaded with a hunt photo (shown at ~32–64 CSS px, sharp on a 3x screen). */
export const THUMB_MAX_SIDE = 320;

function encodeJpeg(source: CanvasImageSource & { width: number; height: number }, maxSide: number, quality: number): Promise<Blob> {
  const size = scaledSize(source.width, source.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d')!;
  // A 5x reduction for the thumbnail would alias with the default (low) smoothing
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Foto verkleinen mislukt'))), 'image/jpeg', quality));
}

/**
 * Downscale a photo to at most `maxSide` px on the long side and re-encode it as JPEG (quality 0.8), plus a small
 * list thumbnail (THUMB_MAX_SIDE, quality 0.7) from the same decode. Phone photos are 3–8 MB; this keeps uploads
 * around 300 KB on a bad connection. Uses the EXIF orientation (createImageBitmap `imageOrientation: 'from-image'`),
 * so both come out upright. The thumbnail is null when only it fails.
 */
export async function preparePhoto(file: Blob, maxSide = 1600): Promise<{ photo: Blob; thumb: Blob | null }> {
  const bitmap = await decodeScaled(file, maxSide);
  try {
    const photo = await encodeJpeg(bitmap, maxSide, 0.8);
    const thumb = await encodeJpeg(bitmap, THUMB_MAX_SIDE, 0.7).catch(() => null);
    return { photo, thumb };
  } finally {
    bitmap.close();
  }
}
