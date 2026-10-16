import { useAndroidPromoAutoOpen } from '@/hooks/android-promo.hook';

/** Renders nothing: runs the Android-app popup auto-open in its own component, so its /account polls only re-render this. */
export default function AndroidPromoAutoOpen() {
  useAndroidPromoAutoOpen();
  return null;
}
