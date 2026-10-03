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

interface ReplaceMarkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areaName: string;
  onConfirm: () => void;
}

/**
 * Asks whether the existing hint marker of this hour should be replaced by the new answer.
 */
export default function ReplaceMarkerDialog({ open, onOpenChange, areaName, onConfirm }: ReplaceMarkerDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hint-marker vervangen?</AlertDialogTitle>
          <AlertDialogDescription>Er staat al een hint-marker voor {areaName} op dit uur. Wil je die vervangen door dit antwoord?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Vervangen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
