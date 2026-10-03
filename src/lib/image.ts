/**
 * createImageBitmap resize hint that brings the long side to `maxSide`, or null when the image is small enough already.
 * Only one side is given (the browser keeps the aspect ratio): if the browser applies it before the EXIF rotation, the
 * result is merely larger than needed, never distorted; downscalePhoto clamps it afterwards.
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

/**
 * Downscale a photo to at most `maxSide` px on the long side and re-encode it as JPEG (quality 0.8).
 * Phone photos are 3–8 MB; this keeps uploads around 300 KB on a bad connection.
 * Uses the EXIF orientation (createImageBitmap `imageOrientation: 'from-image'`).
 */
export async function downscalePhoto(file: Blob, maxSide = 1600): Promise<Blob> {
  const bitmap = await decodeScaled(file, maxSide);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Foto verkleinen mislukt'))), 'image/jpeg', 0.8));
}
