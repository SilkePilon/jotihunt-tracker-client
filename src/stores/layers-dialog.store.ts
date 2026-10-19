import { create } from 'zustand';

interface LayersDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** The "Kaart & lagen" drawer (phones), opened from the gear menu. */
const useLayersDialogStore = create<LayersDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export default useLayersDialogStore;
