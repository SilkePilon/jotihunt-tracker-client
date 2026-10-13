import type { ReactNode } from 'react';
import { GlobeIcon } from 'lucide-react';
import { siGithub } from 'simple-icons';
import backgroundImage from '@/assets/images/background.webp';
import { useTheme } from '@/hooks/theme.hook';

/** Login, invite and herstel pages: the photo fills the screen (dimmed), the card floats on top. */
export default function AuthScreen({ children }: { children: ReactNode }) {
  useTheme();
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-end p-4 md:justify-center md:p-10">
      <img src={backgroundImage} alt="" className="absolute inset-0 size-full object-cover brightness-[0.45] dark:brightness-[0.3] dark:grayscale" />
      <div className="relative flex w-full flex-col items-center gap-5">
        {children}
        {/* Haal onderstaande alsjeblieft niet weg! Zo help je andere ook een beetje :) */}
        <p className="text-center text-xs text-white/70 md:text-sm">
          Ontwikkeling door Silke Pilon ·{' '}
          <a href="https://silkepilon.dev" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
            <GlobeIcon className="size-3" />
            Website
          </a>{' '}
          ·{' '}
          <a href="https://github.com/SilkePilon" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
            <span className="size-3 fill-white/70" dangerouslySetInnerHTML={{ __html: siGithub.svg }} />
            GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
