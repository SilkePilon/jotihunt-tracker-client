import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { motion } from 'motion/react';
import { RotateCwIcon, WifiOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/lib/chunk-error';
import { SWAP } from '@/lib/motion';
import { TONAL_BUTTON } from '@/lib/tonal-button';
import { cn } from '@/lib/utils';
import { CARD_TITLE } from '@/lib/dialog-shell';

interface ChunkBoundaryProps {
  /** E.g. "Beheer", for the message */
  name: string;
  className?: string;
  /** Only catch failed chunk downloads; any other crash goes on to the next boundary up (e.g. the page ErrorBoundary) */
  chunksOnly?: boolean;
  children: ReactNode;
}

/**
 * Around a lazy (code-split) part inside a window: when its chunk can't be downloaded (offline, or a deploy replaced
 * it) the window shows that in place, with "Opnieuw laden", instead of the whole window giving way to an error card.
 * A failed import stays cached by React.lazy, so only a page reload retries it.
 */
export default class ChunkBoundary extends Component<ChunkBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ChunkBoundary: ${this.props.name}]`, error, info.componentStack);
    // A failed download is the network, not a bug; a real crash still goes to Sentry
    // (chunksOnly passes it on: the parent boundary reports it)
    if (!isChunkLoadError(error) && !this.props.chunksOnly) Sentry.captureException(error, { tags: { boundary: this.props.name }, contexts: { react: { componentStack: info.componentStack ?? '' } } });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);
    if (this.props.chunksOnly && !chunk) throw error;
    return (
      <motion.div role="alert" className={cn('flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center', this.props.className)} {...SWAP}>
        <div className="grid size-10 place-items-center rounded-xl bg-beheer-row-high text-muted-foreground">
          <WifiOffIcon className="size-5" />
        </div>
        <div className="max-w-xs space-y-1">
          <p className={CARD_TITLE}>{this.props.name} kon niet worden geladen</p>
          <p className="text-body text-muted-foreground">{chunk ? 'Controleer je verbinding en laad de app opnieuw.' : 'Er ging iets mis. Laad de app opnieuw.'}</p>
        </div>
        <Button variant="ghost" className={cn(TONAL_BUTTON, 'px-4')} onClick={() => window.location.reload()}>
          <RotateCwIcon />
          Opnieuw laden
        </Button>
      </motion.div>
    );
  }
}
