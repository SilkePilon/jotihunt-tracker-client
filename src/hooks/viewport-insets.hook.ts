import { useEffect } from 'react';
import { keyboardInset, visibleHeight } from '@/lib/viewport';
import useViewportStore from '@/stores/viewport.store';

/** Reads env(safe-area-inset-*) through a hidden probe element (JS has no direct API for it). */
function readSafeAreas(probe: HTMLElement) {
  const style = getComputedStyle(probe);
  return { safeTop: parseFloat(style.paddingTop) || 0, safeBottom: parseFloat(style.paddingBottom) || 0 };
}

/**
 * Keeps the viewport store up to date: visual viewport size, keyboard inset (also as the CSS variable --kb on
 * <html>) and safe areas. Recomputes after rotation and after an input loses focus (iOS 26 leaves
 * visualViewport.offsetTop stale after the keyboard closes).
 */
export function useViewportInsets() {
  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(probe);
    const vv = window.visualViewport;
    const timers: number[] = [];

    const update = () => {
      const keyboard = keyboardInset(window.innerHeight, vv);
      document.documentElement.style.setProperty('--kb', `${keyboard}px`);
      useViewportStore.getState().set({ visibleH: visibleHeight(window.innerHeight, vv), keyboard, ...readSafeAreas(probe) });
    };
    const later = (ms: number) => () => timers.push(window.setTimeout(update, ms));
    const onRotate = later(300);
    const onFocusOut = later(350);

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', onRotate);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', onRotate);
      document.removeEventListener('focusout', onFocusOut);
      timers.forEach(clearTimeout);
      probe.remove();
      document.documentElement.style.removeProperty('--kb');
    };
  }, []);
}
