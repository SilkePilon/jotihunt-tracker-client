import { useEffect, useState } from 'react';
import { CopyButton as AnimatedCopyButton } from '@/components/animate-ui/components/buttons/copy';
import { copyToClipboard } from '@/lib/clipboard';

/** How long the check mark stays after copying */
const COPIED_MS = 2000;

/** Our icon-button sizes on animate-ui's copy button sizes; icon-xs keeps the smaller size-6 of shadcn's icon-xs. */
const SIZES = {
  'icon-xs': { size: 'xs', className: 'size-6' },
  'icon-sm': { size: 'sm', className: undefined },
  icon: { size: 'default', className: undefined },
} as const;

interface CopyButtonProps {
  value: string;
  /** What is copied, e.g. "Code": used for the aria-label ("Code kopiëren") and the toast ("Code gekopieerd") */
  label: string;
  /** Overrides the default "<label> gekopieerd" toast */
  successMessage?: string;
  size?: 'icon-xs' | 'icon-sm' | 'icon';
  /** Outline (default) or ghost, for buttons on a tinted row */
  variant?: 'outline' | 'ghost';
}

/**
 * Small outline icon button that copies a value to the clipboard; the copy icon animates into a check mark.
 * Copying goes through copyToClipboard (toast either way, also when the clipboard API is missing on plain http),
 * so animate-ui's button is used controlled and never copies by itself.
 */
export default function CopyButton({ value, label, successMessage, size = 'icon-xs', variant = 'outline' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <AnimatedCopyButton
      type="button"
      variant={variant}
      size={SIZES[size].size}
      className={SIZES[size].className}
      aria-label={`${label} kopiëren`}
      content=""
      copied={copied}
      onClick={async () => {
        if (await copyToClipboard(value, successMessage ?? `${label} gekopieerd`)) setCopied(true);
      }}
    />
  );
}
