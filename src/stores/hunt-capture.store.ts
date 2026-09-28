import { create } from 'zustand';

interface HuntCaptureState {
  /** Photo waiting to be registered */
  photo: File | null;
  open: boolean;
  startCapture: (photo: File) => void;
  close: () => void;
}

/** Shared between the camera button / sidebar button (which pick a photo) and the registration dialog. */
const useHuntCaptureStore = create<HuntCaptureState>()((set) => ({
  photo: null,
  open: false,
  startCapture: (photo) => set({ photo, open: true }),
  close: () => set({ open: false, photo: null }),
}));

export default useHuntCaptureStore;
