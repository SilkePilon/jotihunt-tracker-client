import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useDemo } from '@/hooks/demo.hook';
import { apiErrorMessage } from '@/lib/api-error';

interface DemoModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Admin confirmation for switching demo mode; reloads the page on success, stays busy while switching. */
export default function DemoModeDialog({ open, onOpenChange }: DemoModeDialogProps) {
  const { demo, setDemo } = useDemo();
  const turnDemoOn = !demo?.enabled;

  async function handleSwitch() {
    try {
      await setDemo(turnDemoOn);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Het wisselen van demo mode is mislukt.'));
      onOpenChange(false);
      return;
    }
    window.location.reload();
    // Stay busy until the page is gone
    await new Promise(() => {});
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={turnDemoOn ? 'Demo mode aanzetten?' : 'Demo mode uitzetten?'}
      description={turnDemoOn ? 'Iedereen ziet dan demo-gegevens. De echte gegevens blijven bewaard.' : 'De demo-gegevens verdwijnen.'}
      confirmLabel={turnDemoOn ? 'Aanzetten' : 'Uitzetten'}
      onConfirm={handleSwitch}
    />
  );
}
