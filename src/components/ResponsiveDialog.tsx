import { ReactNode, useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/media.hook';
import { cn } from '@/lib/utils';

interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  /** Extra classes for the desktop dialog, e.g. a narrower width */
  className?: string;
  /** Keep the title and description for screen readers only, when the children render their own header */
  hideHeader?: boolean;
  /** Size to the content instead of a fixed large height, for short forms */
  compact?: boolean;
  /** After `open` turned false and the slide-out / fade-out has finished, e.g. to unmount the dialog */
  onClosed?: () => void;
}

// vaul's slide-out (TRANSITIONS.DURATION) and the Radix dialog's `duration-200` fade/zoom-out, plus a margin so the content never unmounts a frame early
const DRAWER_CLOSE_MS = 500;
const DIALOG_CLOSE_MS = 250;

/** Frame shared by the large dialogs: a large dialog on desktop, a bottom drawer on phones. */
export default function ResponsiveDialog({ open, onClose, title, description, children, className, hideHeader, compact, onClosed }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  // Keep the content while the drawer slides out / the dialog fades out, instead of an empty frame leaving
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });

  // A timer instead of vaul's onAnimationEnd: that one only fires for closes vaul starts itself (swipe, overlay), not when `open` is set to false
  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(
      () => {
        setMounted(false);
        onClosedRef.current?.();
      },
      isMobile ? DRAWER_CLOSE_MS : DIALOG_CLOSE_MS,
    );
    return () => clearTimeout(timer);
  }, [open, mounted, isMobile]);

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content className={cn('fixed inset-x-0 bottom-0 z-50 flex flex-col', compact ? 'max-h-[92dvh]' : 'h-[92dvh]', 'rounded-t-2xl border-t bg-background outline-none')}>
            <Drawer.Handle className="mx-auto mb-1 mt-2" />
            <div className={hideHeader ? 'sr-only' : 'px-4 pb-3 pt-1'}>
              <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
              <Drawer.Description className="text-sm text-muted-foreground">{description}</Drawer.Description>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{mounted && children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn('flex max-h-[80dvh] flex-col gap-4 sm:max-w-4xl', !compact && 'h-[80dvh]', className)}>
        <DialogHeader className={cn(hideHeader && 'sr-only')}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {mounted && children}
      </DialogContent>
    </Dialog>
  );
}
