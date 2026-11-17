import { create } from "zustand";

/** `reveal`: from the map's "In hint" on a laptop: the form scrolls into view and the focus goes to Deelgebied */
type Coords = { x: string; y: string; reveal?: boolean } | null;

type HintFormBridge = {
    coords: Coords;
    setCoords: (x: string, y: string, options?: { reveal?: boolean }) => void;
    clear: () => void;
};

export const useHintFormBridge = create<HintFormBridge>((set) => ({
    coords: null,
    setCoords: (x, y, options) => set({ coords: { x, y, reveal: options?.reveal } }),
    clear: () => set({ coords: null }),
}));
