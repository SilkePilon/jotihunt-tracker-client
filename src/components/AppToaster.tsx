import { Toaster } from '@/components/ui/sonner';
import { useLandscapePhone } from '@/hooks/media.hook';
import { belowSafeArea, phoneTopStack } from '@/lib/top-stack';
import useTopStackStore from '@/stores/top-stack.store';

/**
 * The app's toaster. A phone held sideways has the sheet as a left column: top-centre toasts would cover it, so they
 * stand top-right over the map there, still below the offline badge, the happy-hour pill and the drawing toolbar, and
 * clear of the notch / camera cutout.
 */
export default function AppToaster() {
  const sideways = useLandscapePhone();
  const heights = useTopStackStore((s) => s.heights);
  if (!sideways) return <Toaster />;
  const offset = { top: belowSafeArea(phoneTopStack(heights).toastTop), right: 'calc(env(safe-area-inset-right) + 12px)' };
  return <Toaster position="top-right" offset={offset} mobileOffset={offset} />;
}
