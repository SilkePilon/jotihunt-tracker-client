import { useEffect, useState } from 'react';
import burgerkingUrl from '@/assets/brands/burgerking.svg?url';
import kfcUrl from '@/assets/brands/kfc.svg?url';
import mcdonaldsUrl from '@/assets/brands/mcdonalds.svg?url';
import { BRANDS, type Brand } from '@/lib/fastfood';

export const BRAND_LOGO_URL: Record<Brand, string> = { mcdonalds: mcdonaldsUrl, kfc: kfcUrl, burgerking: burgerkingUrl };
/** Logo width on the 28px marker tile (the popup's 36px icon uses these + 4) */
export const FASTFOOD_LOGO_WIDTH: Record<Brand, number> = { mcdonalds: 15, kfc: 17, burgerking: 19 };

const images = new Map<Brand, HTMLImageElement>();
let loading: Promise<void> | undefined;
/** True once every logo has loaded or failed */
let settled = false;

/** Load the three logos once; a logo that fails to load is left out (the tile is drawn without it). */
export function loadBrandLogos(): Promise<void> {
  loading ??= Promise.all(
    BRANDS.map(
      (brand) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => {
            images.set(brand, image);
            resolve();
          };
          image.onerror = () => resolve();
          image.src = BRAND_LOGO_URL[brand];
        }),
    ),
  ).then(() => {
    settled = true;
  });
  return loading;
}

/** The loaded logo for the canvas marker, undefined before loadBrandLogos finished. */
export function brandLogo(brand: Brand): HTMLImageElement | undefined {
  return images.get(brand);
}

/** True once the logos are loaded: the fastfood layer waits for it, so its icons are never drawn without logo. */
export function useBrandLogosReady(): boolean {
  const [ready, setReady] = useState(() => settled);
  useEffect(() => {
    let cancelled = false;
    void loadBrandLogos().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}
