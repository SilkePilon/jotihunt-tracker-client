import { ReactNode, useState } from 'react';
import useHuntCaptureStore from '@/stores/hunt-capture.store';

/**
 * Hidden file input for a hunt photo. With `capture` the phone opens the rear camera directly; without it
 * (desktop) a file picker opens. The chosen photo goes to the capture store, which opens the registration dialog.
 */
export default function HuntPhotoInput({ capture, children }: { capture: boolean; children: (open: () => void) => ReactNode }) {
  // Callback ref in state: the open function reads no ref during render (React Compiler rule)
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const startCapture = useHuntCaptureStore((state) => state.startCapture);

  return (
    <>
      <input
        ref={setInput}
        type="file"
        accept="image/*"
        capture={capture ? 'environment' : undefined}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) startCapture(file);
        }}
      />
      {children(() => input?.click())}
    </>
  );
}
