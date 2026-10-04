import { ArrowLeftIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface IntelTopBarProps {
  /** The label of the next-hint hook; nothing while it loads */
  nextHint?: string;
  /** Whether `nextHint` is the time left: that gets "Volgende hint" in front, a message ("Nieuwe hint!") stands on its own */
  isCountdown?: boolean;
}

/** The bar above the hints page: back to the map, the page title and the countdown to the next hint */
export default function IntelTopBar({ nextHint, isCountdown = false }: IntelTopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-3">
      <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
        <ArrowLeftIcon data-icon="inline-start" />
        Kaart
      </Button>
      <p className="truncate text-sm font-semibold">Hints, opdrachten &amp; nieuws</p>
      {nextHint && (
        <Badge variant="outline" className="ml-auto border-amber-500/30 bg-amber-500/15 tabular-nums text-amber-700 dark:text-amber-300">
          {isCountdown ? `Volgende hint ${nextHint}` : nextHint}
        </Badge>
      )}
    </header>
  );
}
