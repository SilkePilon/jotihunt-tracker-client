import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronUpIcon, ClockIcon, DownloadIcon, EyeOffIcon } from 'lucide-react';
import { EASE_OUT } from '@/lib/motion';

/** M3 Expressive split button: Download, with ▾ for "Later herinneren" / "Niet meer tonen". */
export default function DownloadSplitButton({ version, onDownload, onLater, onNever }: { version: string; onDownload: () => void; onLater: () => void; onNever: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => !ref.current?.contains(event.target as Node) && setMenuOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div ref={ref} className="relative flex gap-0.5">
      <button type="button" onClick={onDownload} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-l-xl rounded-r-[4px] bg-primary text-[14.5px] font-semibold text-primary-foreground active:scale-[.98]">
        <DownloadIcon className="size-5" /> Download · {version}
      </button>
      <motion.button
        type="button"
        aria-label="Meer opties"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((o) => !o)}
        animate={{ borderRadius: menuOpen ? '24px 24px 24px 24px' : '4px 12px 12px 4px' }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="grid h-12 w-12 place-items-center bg-primary text-primary-foreground"
      >
        <motion.span animate={{ rotate: menuOpen ? 0 : 180 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
          <ChevronUpIcon className="size-5" />
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            style={{ transformOrigin: 'bottom right' }}
            className="absolute bottom-[54px] right-0 min-w-[190px] rounded-2xl bg-card p-1.5 shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/.5)]"
          >
            <button type="button" role="menuitem" onClick={onLater} className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13.5px] font-semibold hover:bg-beheer-row-high">
              <ClockIcon className="size-5" /> Later herinneren
            </button>
            <button type="button" role="menuitem" onClick={onNever} className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13.5px] font-semibold hover:bg-beheer-row-high">
              <EyeOffIcon className="size-5" /> Niet meer tonen
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
