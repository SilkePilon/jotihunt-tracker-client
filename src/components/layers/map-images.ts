/** Helpers for the icons the map layers draw with map.addImage (SVGs and HTML can't be added to MapLibre directly). */

/** Pixel ratio the map images are rasterised at: the screen's, rounded, at most 3. */
export function mapImagePixelRatio(): number {
  return Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
}

/** Draw an image (e.g. an SVG asset) into a square of `sizePx` CSS pixels at `pixelRatio`. */
export async function rasterize(url: string, sizePx: number, pixelRatio: number): Promise<ImageData> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const size = sizePx * pixelRatio;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0, size, size);
  return context.getImageData(0, 0, size, size);
}

function mapPixels(image: ImageData, fn: (r: number, g: number, b: number) => [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(image.data);
  for (let i = 0; i < data.length; i += 4) [data[i], data[i + 1], data[i + 2]] = fn(data[i], data[i + 1], data[i + 2]);
  return new ImageData(data, image.width, image.height);
}

/** Like CSS `brightness(factor)` (the HTML markers' hover effect). */
export function brighten(image: ImageData, factor = 1.25): ImageData {
  return mapPixels(image, (r, g, b) => [r * factor, g * factor, b * factor]);
}

/** Like CSS `grayscale(1)`. */
export function grayscale(image: ImageData): ImageData {
  return mapPixels(image, (r, g, b) => {
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return [luminance, luminance, luminance];
  });
}
