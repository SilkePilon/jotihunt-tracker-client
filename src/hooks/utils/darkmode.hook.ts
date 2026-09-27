import { useSyncExternalStore } from 'react';

/**
 * Subscribe to class changes on the body element.
 * @param onChange Callback invoked when the body class list changes
 * @returns Unsubscribe function
 */
function subscribe(onChange: () => void) {
  const mutationObserver = new MutationObserver(onChange);
  mutationObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return () => mutationObserver.disconnect();
}

function checkDarkMode() {
  return document.body.classList.contains('dark');
}

/**
 * Hook that returns whether dark mode is currently active (i.e. the body has the `dark` class).
 */
export const useDarkMode = () => useSyncExternalStore(subscribe, checkDarkMode);
