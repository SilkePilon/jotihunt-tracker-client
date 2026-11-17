import { useAndroidPromoAutoOpen } from '@/hooks/android-promo.hook';
import { useAppRelease } from '@/hooks/app-pairing.hook';
import useAndroidPromoStore from '@/stores/android-promo.store';
import { useModalHold } from '@/stores/prompt-queue.store';

/**
 * Renders nothing: runs the Android-app popup auto-open in its own component, so its /account polls only re-render this.
 * Also holds the prompt queue while the popup is on screen (AndroidPromoDialog shows it once the release is known), so
 * no other follow-up prompt opens over it when it was opened from the split button.
 */
export default function AndroidPromoAutoOpen() {
  useAndroidPromoAutoOpen();
  const open = useAndroidPromoStore((state) => state.open);
  const { release } = useAppRelease();
  useModalHold(open && !!release);
  return null;
}
