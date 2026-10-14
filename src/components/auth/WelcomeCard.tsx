import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import SuccessBadge from '@/components/auth/SuccessBadge';
import { fadeUp } from '@/lib/motion';

/** After signup or herstel: the same green cookie check as "Mijn tracker". */
export default function WelcomeCard({ name, withPasskey }: { name: string; withPasskey: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-7 text-center text-card-foreground shadow-lg">
      <SuccessBadge size={72} />
      <motion.h2 className="mt-2 text-lg font-semibold" {...fadeUp(0.2)}>
        Welkom, {name}!
      </motion.h2>
      <motion.p className="text-sm text-muted-foreground" {...fadeUp(0.3)}>
        {withPasskey ? 'Je account en passkey zijn klaar. Volgende keer log je in met één tik.' : 'Je account is klaar. Voeg later een passkey toe om sneller in te loggen.'}
      </motion.p>
      <motion.div className="mt-1 w-full" {...fadeUp(0.4)}>
        <Button className="w-full" onClick={() => navigate('/')}>
          Naar de kaart
        </Button>
      </motion.div>
    </div>
  );
}
