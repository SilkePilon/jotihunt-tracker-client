import { useEffect, useState } from 'react';
import useViewportStore from '@/stores/viewport.store';
import useSidebarStore from '@/stores/sidebar.store';

/** `?viewport-debug`: live viewport numbers for checking the sheet above bottom browser toolbars on real phones. */
export default function ViewportDebug({ snaps }: { snaps: Record<string, number> }) {
  const enabled = new URLSearchParams(window.location.search).has('viewport-debug');
  const viewport = useViewportStore();
  const snap = useSidebarStore((s) => s.sheetSnap);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [enabled]);
  if (!enabled) return null;
  const vv = window.visualViewport;
  const rows: [string, string | number][] = [
    ['innerHeight', window.innerHeight],
    ['clientHeight', document.documentElement.clientHeight],
    ['vv.height', vv ? Math.round(vv.height) : '—'],
    ['vv.offsetTop', vv ? Math.round(vv.offsetTop) : '—'],
    ['safeTop / safeBottom', `${viewport.safeTop} / ${viewport.safeBottom}`],
    ['--kb', viewport.keyboard],
    ['standalone', String(window.matchMedia('(display-mode: standalone)').matches)],
    ['snap', snap],
    ...Object.entries(snaps).map(([k, v]) => [`h.${k}`, v] as [string, number]),
  ];
  return (
    <div className="pointer-events-none fixed left-2 top-[calc(env(safe-area-inset-top)+8px)] z-[100] rounded-lg bg-black/75 px-2 py-1 font-mono text-[10.5px] leading-tight text-white">
      {rows.map(([k, v]) => (
        <div key={k}>
          {k}: {v}
        </div>
      ))}
    </div>
  );
}
