import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronUpIcon, ClockIcon, DownloadIcon, EyeOffIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EASE_OUT } from '@/lib/motion';

/**
 * M3 Expressive split button: Download, with ▾ for "Later herinneren" / "Niet meer tonen". The menu is the shared
 * Radix dropdown (MENU_SURFACE rows, arrow keys, Escape, focus return); the trigger keeps its shape morph.
 */
export default function DownloadSplitButton({ version, onDownload, onLater, onNever }: { version: string; onDownload: () => void; onLater: () => void; onNever: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex gap-0.5">
      <button
        type="button"
        onClick={onDownload}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-l-xl rounded-r-[4px] bg-primary-container text-[15px] font-semibold text-on-primary-container outline-none focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[.98]"
      >
        <DownloadIcon className="size-5" /> Download · {version}
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <motion.button
            type="button"
            aria-label="Meer opties"
            animate={{ borderRadius: menuOpen ? '24px 24px 24px 24px' : '4px 12px 12px 4px' }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            // Stays primary-container while open, like its Download half: only the shape and the chevron move
            className="grid h-12 w-12 place-items-center bg-primary-container text-on-primary-container outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <motion.span animate={{ rotate: menuOpen ? 0 : 180 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
              <ChevronUpIcon className="size-5" />
            </motion.span>
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="min-w-[190px]">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onLater}>
              <ClockIcon className="size-5" /> Later herinneren
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onNever}>
              <EyeOffIcon className="size-5" /> Niet meer tonen
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
