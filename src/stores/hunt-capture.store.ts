import { create } from 'zustand';

interface HuntCaptureState {
  /** Photo waiting to be registered; null for a QR hunt ("Foto bij hunt" off) */
  photo: File | null;
  open: boolean;
  /** Bumped on every start: the dialog resets its form for each new hunt (also two QR hunts in a row) */
  session: number;
  /** When the hunter started this hunt (ms); a QR hunt is sent with this as its time */
  startedAt: number;
  startCapture: (photo: File) => void;
  /** Report a hunt without a photo (QR hunt) */
  startReport: () => void;
  close: () => void;
}

/** Shared between the hunt buttons (which pick a photo, or start a QR hunt) and the registration dialog. */
const useHuntCaptureStore = create<HuntCaptureState>()((set) => ({
  photo: null,
  open: false,
  session: 0,
  startedAt: 0,
  startCapture: (photo) => set((state) => ({ photo, open: true, session: state.session + 1, startedAt: Date.now() })),
  startReport: () => set((state) => ({ photo: null, open: true, session: state.session + 1, startedAt: Date.now() })),
  // The photo stays until the next start, so the closing dialog doesn't swap to the QR form during its exit animation
  close: () => set({ open: false }),
}));

export default useHuntCaptureStore;
