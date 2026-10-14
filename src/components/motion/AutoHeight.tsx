import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react';
import { SWAP_TRANSITION } from '@/lib/motion';

interface AutoHeightProps {
  /** Key of the scene shown inside (the AnimatePresence child's key): only a height change caused by a new scene animates */
  scene: string;
  children: ReactNode;
  /** Wrapper (clips only while it animates between scenes) */
  className?: string;
  /** Measured content box; give it padding plus a matching negative margin on the wrapper to keep focus rings and shadows unclipped mid-swap */
  innerClassName?: string;
}

/**
 * Animates the container's height when one scene replaces another, so it grows/shrinks between states instead of jumping.
 * Any other height change (a Reveal unfolding, text rewrapping) is followed instantly: the wrapper rests at `height: auto`
 * with overflow visible, so content is never clipped while it grows and the card's shadow is never cut off.
 */
export default function AutoHeight({ scene, children, className, innerClassName }: AutoHeightProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const sceneRef = useRef(scene);
  const reducedRef = useRef(reducedMotion);
  useLayoutEffect(() => {
    sceneRef.current = scene;
    reducedRef.current = reducedMotion;
  });

  useLayoutEffect(() => {
    const outer = wrapper.current;
    const element = inner.current;
    if (!outer || !element) return;
    let lastHeight: number | null = null;
    let measuredScene = sceneRef.current;
    let running: AnimationPlaybackControls | null = null;

    function rest() {
      running?.stop();
      running = null;
      if (!outer) return;
      outer.style.height = '';
      outer.style.overflow = '';
    }

    // Resize notifications arrive after layout and before paint, so pinning the old height here never shows a jumped frame
    const observer = new ResizeObserver(() => {
      const next = element.offsetHeight;
      const previous = lastHeight;
      lastHeight = next;
      const swapped = measuredScene !== sceneRef.current;
      measuredScene = sceneRef.current;
      if (previous === null || previous === next) return;
      if (!swapped || reducedRef.current) {
        // Content moving within a scene (or mid-swap): follow it at once rather than ease after a moving target
        rest();
        return;
      }
      const from = running ? outer.offsetHeight : previous;
      running?.stop();
      outer.style.overflow = 'hidden';
      outer.style.height = `${from}px`;
      const animation = animate(outer, { height: [from, next] }, SWAP_TRANSITION);
      running = animation;
      void animation.then(() => {
        if (running === animation) rest();
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      rest();
    };
  }, []);

  return (
    <div ref={wrapper} className={className}>
      <div ref={inner} className={innerClassName}>
        {children}
      </div>
    </div>
  );
}
