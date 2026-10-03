import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDemo } from '@/hooks/demo.hook';

interface DemoModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Admin confirmation for switching demo mode; reloads the page on success, stays busy while switching. */
export default function DemoModeDialog({ open, onOpenChange }: DemoModeDialogProps) {
  const { demo, setDemo } = useDemo();
  const [isSwitching, setIsSwitching] = useState(false);
  const turnDemoOn = !demo?.enabled;

  async function handleSwitch() {
    setIsSwitching(true);
    try {
      await setDemo(turnDemoOn);
      window.location.reload();
    } catch (error) {
      const message =
        isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Het wisselen van demo mode is mislukt.';
      toast.error(message);
      setIsSwitching(false);
      onOpenChange(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isSwitching) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{turnDemoOn ? 'Demo mode aanzetten?' : 'Demo mode uitzetten?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {turnDemoOn
              ? 'Iedereen ziet dan demo-gegevens. De echte gegevens blijven bewaard.'
              : 'De demo-gegevens verdwijnen.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSwitching}>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSwitching}
            onClick={(e) => {
              e.preventDefault();
              void handleSwitch();
            }}
          >
            {isSwitching && <Loader2Icon className="animate-spin" />}
            {turnDemoOn ? 'Aanzetten' : 'Uitzetten'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
