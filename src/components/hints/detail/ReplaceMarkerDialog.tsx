import ConfirmDialog from '@/components/ConfirmDialog';

interface ReplaceMarkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areaName: string;
  onConfirm: () => Promise<unknown> | unknown;
}

/**
 * Asks whether the existing hint marker of this hour should be replaced by the new answer.
 */
export default function ReplaceMarkerDialog({ open, onOpenChange, areaName, onConfirm }: ReplaceMarkerDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Hint-marker vervangen?"
      description={`Er staat al een hint-marker voor ${areaName} op dit uur. Wil je die vervangen door dit antwoord?`}
      confirmLabel="Vervangen"
      onConfirm={async () => {
        await onConfirm();
        onOpenChange(false);
      }}
    />
  );
}
