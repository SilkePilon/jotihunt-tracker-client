import { create } from 'zustand';

interface HappyHourPillState {
  /** Whether the happy-hour pill is on screen; phone toasts move down below it while it is (ui/sonner.tsx) */
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const useHappyHourPillStore = create<HappyHourPillState>()((set) => ({
  visible: false,
  setVisible: (visible) => set({ visible }),
}));

export default useHappyHourPillStore;
