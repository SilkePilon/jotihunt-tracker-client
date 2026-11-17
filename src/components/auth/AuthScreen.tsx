import type { ReactNode } from 'react';
import { GlobeIcon } from 'lucide-react';
import { siGithub } from 'simple-icons';
import backgroundImage from '@/assets/images/background.webp';
import { useTheme } from '@/hooks/theme.hook';
import NewTabHint from '@/components/NewTabHint';

/**
 * Login, invite and herstel pages: the photo fills the screen (dimmed), the card floats on top.
 * html/body never scroll (map app), so this screen scrolls inside its own full-height container.
 * Padding keeps clear of the notch / home indicator (safe-area insets) and never drops below 16px (40px from md).
 */
export default function AuthScreen({ children }: { children: ReactNode }) {
  useTheme();
  return (
    <div className="h-svh overflow-y-auto overscroll-contain">
      <img src={backgroundImage} alt="" className="fixed inset-0 size-full object-cover brightness-[0.45] dark:brightness-[0.3] dark:grayscale" />
      <div className="relative flex min-h-full flex-col items-center justify-end pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:justify-center md:pt-[max(2.5rem,env(safe-area-inset-top))] md:pr-[max(2.5rem,env(safe-area-inset-right))] md:pb-[max(2.5rem,env(safe-area-inset-bottom))] md:pl-[max(2.5rem,env(safe-area-inset-left))]">
        {/* The page's landmark (these pages sit outside Layout's <main>) */}
        <main className="relative flex w-full flex-col items-center gap-5">
          {children}
          {/* Haal onderstaande alsjeblieft niet weg! Zo help je andere ook een beetje :) */}
          <p className="text-center text-xs text-white/70 md:text-sm">
            Ontwikkeling door Silke Pilon ·{' '}
            <a href="https://silkepilon.dev" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              <GlobeIcon className="size-3" />
              Website
              <NewTabHint />
            </a>{' '}
            ·{' '}
            <a href="https://github.com/SilkePilon" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              <span aria-hidden className="size-3 fill-white/70" dangerouslySetInnerHTML={{ __html: siGithub.svg }} />
              GitHub
              <NewTabHint />
            </a>
          </p>
        </main>
      </div>
    </div>
  );
}
