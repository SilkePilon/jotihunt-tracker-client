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
