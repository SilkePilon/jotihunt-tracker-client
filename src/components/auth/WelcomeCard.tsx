import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import CookieBadge from '@/components/tracker/CookieBadge';

/** After signup or herstel: the same green cookie check as "Mijn tracker". */
export default function WelcomeCard({ name, withPasskey }: { name: string; withPasskey: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-7 text-center text-card-foreground shadow-lg">
      <CookieBadge tone="ok" size={72} />
      <h2 className="mt-2 text-lg font-semibold">Welkom, {name}!</h2>
      <p className="text-sm text-muted-foreground">
        {withPasskey ? 'Je account en passkey zijn klaar. Volgende keer log je in met één tik.' : 'Je account is klaar. Voeg later een passkey toe om sneller in te loggen.'}
      </p>
      <Button className="mt-1 w-full" onClick={() => navigate('/')}>
        Naar de kaart
      </Button>
    </div>
  );
}
