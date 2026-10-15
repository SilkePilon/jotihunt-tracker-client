// src/stores/android-promo.store.ts
import { create } from 'zustand';
import { laterState, writePromoState } from '@/lib/android-promo';

export type PromoStep = 'intro' | 'download' | 'install' | 'pair' | 'done';
export type PromoClose = 'later' | 'never' | 'paired' | 'dismiss';

interface AndroidPromoState {
  open: boolean;
  step: PromoStep;
  setStep: (step: PromoStep) => void;
  /** Open at the intro (auto-open and the menu row) */
  show: () => void;
  /** Close and remember why: later = 3 days, never/paired = forever, dismiss = nothing stored */
  close: (result: PromoClose) => void;
}

const useAndroidPromoStore = create<AndroidPromoState>()((set) => ({
  open: false,
  step: 'intro',
  setStep: (step) => set({ step }),
  show: () => set({ open: true, step: 'intro' }),
  close: (result) => {
    // Blocked storage (e.g. Safari private mode) can throw; the popup must still close
    try {
      if (result === 'later') writePromoState(localStorage, laterState(Date.now()));
      if (result === 'never' || result === 'paired') writePromoState(localStorage, { never: true });
    } catch {
      // Nothing stored: it may show again next session
    }
    set({ open: false });
  },
}));

export default useAndroidPromoStore;
