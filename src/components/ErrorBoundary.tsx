import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Variant = 'page' | 'section' | 'inline' | 'floating';

interface ErrorBoundaryProps {
  /** Shown in the fallback, e.g. "De kaart" */
  name?: string;
  /**
   * page: whole screen with a reload button (app level). section: card with retry (map, cards). inline: the same
   * without the card, inside something that already is one (a sidebar section's content).
   * floating: small card at the bottom of the screen (dialogs, which render in a portal and have no place of their own).
   */
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches a render crash in its children, so one broken part shows a message instead of white-screening the whole app. */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ''}]`, error, info.componentStack);
    Sentry.captureException(error, {
      tags: { boundary: this.props.name ?? this.props.variant ?? 'section' },
      contexts: { react: { componentStack: info.componentStack ?? '' } },
    });
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { name, variant = 'section', className } = this.props;

    if (variant === 'page') {
      return (
        <div role="alert" className={cn('flex h-dvh w-dvw flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground', className)}>
          <TriangleAlertIcon className="size-10 text-destructive" />
          <div className="max-w-sm space-y-1">
            <p className="text-lg font-semibold">Oeps! Er is iets misgegaan.</p>
            <p className="text-sm text-muted-foreground">De app liep vast. Laad de pagina opnieuw; je gegevens staan veilig op de server.</p>
          </div>
          <Button onClick={() => window.location.reload()}>
            <RotateCwIcon />
            Opnieuw laden
          </Button>
        </div>
      );
    }

    const message = `${name ?? 'Dit onderdeel'} kon niet worden weergegeven.`;
    const actions = (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={this.reset}>
          Opnieuw proberen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
          Opnieuw laden
        </Button>
      </div>
    );

    if (variant === 'floating') {
      return (
        <div role="alert" className={cn('card fixed bottom-4 left-1/2 z-[60] flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 rounded-xl bg-card p-3 text-sm text-card-foreground', className)}>
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
            {message}
          </p>
          {actions}
        </div>
      );
    }

    return (
      <div role="alert" className={cn('flex flex-col gap-2 text-sm', variant === 'section' && 'card rounded-xl bg-card px-3 py-2 text-card-foreground', className)}>
        <p className="flex items-center gap-2 font-medium">
          <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
          {message}
        </p>
        {actions}
      </div>
    );
  }
}
