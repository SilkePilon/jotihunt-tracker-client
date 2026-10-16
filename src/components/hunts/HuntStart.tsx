import type { ReactNode } from 'react';
import { useHuntPhotoSetting } from '@/hooks/hunt-photo.hook';
import useHuntCaptureStore from '@/stores/hunt-capture.store';
import HuntPhotoInput from './HuntPhotoInput';

/**
 * Every "start a hunt" button goes through here. "Foto bij hunt" on: the button opens the camera (phones) or a file
 * picker. Off: no photo input at all, the button opens the registration dialog straight away for a QR hunt.
 */
export default function HuntStart({ capture, children }: { capture: boolean; children: (open: () => void, photoMode: boolean) => ReactNode }) {
  const { photoMode } = useHuntPhotoSetting();
  const startReport = useHuntCaptureStore((state) => state.startReport);
  if (!photoMode) return children(startReport, false);
  return <HuntPhotoInput capture={capture}>{(open) => children(open, true)}</HuntPhotoInput>;
}
