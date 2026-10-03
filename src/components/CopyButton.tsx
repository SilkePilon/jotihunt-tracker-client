import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';

interface CopyButtonProps {
  value: string;
  /** What is copied, e.g. "Code": used for the aria-label ("Code kopiëren") and the toast ("Code gekopieerd") */
  label: string;
  /** Overrides the default "<label> gekopieerd" toast */
  successMessage?: string;
  size?: 'icon-xs' | 'icon-sm' | 'icon';
}

/** Small outline icon button that copies a value to the clipboard. */
export default function CopyButton({ value, label, successMessage, size = 'icon-xs' }: CopyButtonProps) {
  return (
    <Button type="button" variant="outline" size={size} aria-label={`${label} kopiëren`} onClick={() => void copyToClipboard(value, successMessage ?? `${label} gekopieerd`)}>
      <CopyIcon />
    </Button>
  );
}
