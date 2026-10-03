/** Sticker bounding box as Gemini returns it: [ymin, xmin, ymax, xmax], 0..1000 */
export type StickerBox = [number, number, number, number];

export interface Size {
  width: number;
  height: number;
}

/** Image scale and top-left offset (px) inside the frame */
export interface Crop {
  scale: number;
  x: number;
  y: number;
}

/** Never zoom in further than this many times the scale that just covers the frame. */
export const MAX_ZOOM = 6;

/**
 * Show the sticker box, padded by `padding` of its size on each side, as large as fits in the frame while the image
 * still covers the whole frame (no empty edges). Without a box: the whole image, cover-fit and centred.
 */
export function stickerCrop(box: StickerBox | null, image: Size, frame: Size, padding = 0.15): Crop {
  const cover = Math.max(frame.width / image.width, frame.height / image.height);
  let scale = cover;
  let centerX = image.width / 2;
  let centerY = image.height / 2;
  if (box) {
    const [ymin, xmin, ymax, xmax] = box;
    const padX = ((xmax - xmin) / 1000) * image.width * padding;
    const padY = ((ymax - ymin) / 1000) * image.height * padding;
    const left = Math.max(0, (xmin / 1000) * image.width - padX);
    const right = Math.min(image.width, (xmax / 1000) * image.width + padX);
    const top = Math.max(0, (ymin / 1000) * image.height - padY);
    const bottom = Math.min(image.height, (ymax / 1000) * image.height + padY);
    const fit = Math.min(frame.width / (right - left), frame.height / (bottom - top));
    scale = Math.min(Math.max(fit, cover), cover * MAX_ZOOM);
    centerX = (left + right) / 2;
    centerY = (top + bottom) / 2;
  }
  // Offsets run from (frame − scaled image) up to 0, so the image always covers the frame
  const clamp = (value: number, min: number) => Math.min(0, Math.max(min, value));
  return {
    scale,
    x: clamp(frame.width / 2 - centerX * scale, frame.width - image.width * scale),
    y: clamp(frame.height / 2 - centerY * scale, frame.height - image.height * scale),
  };
}
