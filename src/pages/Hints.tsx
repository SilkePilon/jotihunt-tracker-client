import { useNavigate } from 'react-router';
import IntelPage from '@/components/intel/IntelPage';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/media.hook';

/**
 * The hints page (/hints): hints, assignments and news in one place. Desktop only: a phone gets a message and no data
 * is fetched for it.
 */
export default function Hints() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">Deze pagina werkt alleen op een laptop of groter scherm.</p>
        <Button onClick={() => navigate('/')}>Terug naar de kaart</Button>
      </div>
    );
  }

  return <IntelPage />;
}
