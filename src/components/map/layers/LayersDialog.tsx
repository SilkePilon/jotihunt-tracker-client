import ResponsiveDialog from '@/components/ResponsiveDialog';
import { DIALOG_SHELL } from '@/lib/dialog-shell';
import { cn } from '@/lib/utils';
import useLayersDialogStore from '@/stores/layers-dialog.store';
import MapLayersPanel from './MapLayersPanel';

/** Phones: the map style and layers panel in a drawer (desktop uses the map button's popover). */
export default function LayersDialog() {
  const open = useLayersDialogStore((state) => state.open);
  const setOpen = useLayersDialogStore((state) => state.setOpen);
  return (
    <ResponsiveDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Kaart & lagen"
      description="Kaartstijl en zichtbare lagen."
      className={cn(DIALOG_SHELL, 'bg-card p-5 sm:max-w-sm')}
      drawerClassName="bg-card"
      compact
    >
      <div className="min-h-0 overflow-y-auto pb-1">
        <MapLayersPanel fetchLife360={open} />
      </div>
    </ResponsiveDialog>
  );
}
