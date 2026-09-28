import { CameraIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HuntPhotoInput from './HuntPhotoInput';

/**
 * Phones: round camera button at the bottom right, just above the bottom sheet's peek height (132 px).
 * z-30 keeps it under the sheet (z-40) when the sheet is pulled up.
 */
export default function HuntCaptureButton() {
  return (
    <HuntPhotoInput capture>
      {(open) => (
        <Button size="icon-lg" className="fixed bottom-[144px] right-3 z-30 size-14 rounded-full shadow-lg" onClick={open} aria-label="Hunt registreren">
          <CameraIcon className="size-6" />
        </Button>
      )}
    </HuntPhotoInput>
  );
}
