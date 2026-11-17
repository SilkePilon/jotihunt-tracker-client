import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { TopStackHeights, TopStackItem } from '@/lib/top-stack';

interface TopStackState {
  /** Measured heights of what stacks at the top centre (lib/top-stack.ts); 0 when not shown */
  heights: TopStackHeights;
  setHeight: (item: TopStackItem, height: number) => void;
}

const useTopStackStore = create<TopStackState>()((set) => ({
  heights: { badge: 0, pill: 0, toolbar: 0 },
  setHeight: (item, height) => set((state) => (state.heights[item] === height ? state : { heights: { ...state.heights, [item]: height } })),
}));

export default useTopStackStore;

/**
 * Publishes an element's height as `item` of the top stack while `shown` (0 once it starts leaving or unmounts, so the
 * rest moves up together with its exit). Returns the ref callback for the element.
 */
export function usePublishTopHeight(item: TopStackItem, shown: boolean) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const { setHeight } = useTopStackStore.getState();
    if (!shown || !node) {
      setHeight(item, 0);
      return;
    }
    // offsetHeight: the layout height, without the enter/exit transform
    const publish = () => setHeight(item, node.offsetHeight);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => {
      observer.disconnect();
      setHeight(item, 0);
    };
  }, [item, shown, node]);
  return setNode;
}
