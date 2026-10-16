import type { ReactNode } from 'react';
import { useHuntPhotoSetting } from '@/hooks/hunt-photo.hook';
import useHuntCaptureStore from '@/stores/hunt-capture.store';
import HuntPhotoInput from './HuntPhotoInput';

const noop = () => {};

/**
 * Every "start a hunt" button goes through here. "Foto bij hunt" on: the button opens the camera (phones) or a file
 * picker. Off: no photo input at all, the button opens the registration dialog straight away for a QR hunt.
 * While the setting is still loading `ready` is false (disable the button) and nothing starts; it looks like the
 * QR variant meanwhile (the server default).
 */
export default function HuntStart({ capture, children }: { capture: boolean; children: (open: () => void, photoMode: boolean, ready: boolean) => ReactNode }) {
  const { enabled } = useHuntPhotoSetting();
  const startReport = useHuntCaptureStore((state) => state.startReport);
  if (enabled === undefined) return children(noop, false, false);
  if (!enabled) return children(startReport, false, true);
  return <HuntPhotoInput capture={capture}>{(open) => children(open, true, true)}</HuntPhotoInput>;
}
