import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/media.hook';
import { CloseButton } from '@/components/ui/close-button';
import { cn } from '@/lib/utils';
import { keepOpenWhileEditing } from '@/lib/inline-edit';
import { useBackEntry } from '@/hooks/back-entry.hook';

interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  /** Extra classes for the desktop dialog, e.g. a narrower width */
  className?: string;
  /** Extra classes for the phone drawer surface, e.g. its background */
  drawerClassName?: string;
  /** Keep the title and description for screen readers only, when the children render their own header */
  hideHeader?: boolean;
  /** Size to the content instead of a fixed large height, for short forms */
  compact?: boolean;
  /** After `open` turned false and the slide-out / fade-out has finished, e.g. to unmount the dialog */
  onClosed?: () => void;
  /** Escape on the desktop dialog, before the inline-edit guard; call event.preventDefault() to keep the dialog open (e.g. to close a sub-view first) */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Phones: the Back button closes the drawer (default). Off for drawers that manage their own history entry. */
  backEntry?: boolean;
}

// vaul's slide-out (TRANSITIONS.DURATION) and the Radix dialog's `duration-200` fade/zoom-out, plus a margin so the content never unmounts a frame early
const DRAWER_CLOSE_MS = 500;
const DIALOG_CLOSE_MS = 250;

/** Frame shared by the large dialogs: a large dialog on desktop, a bottom drawer on phones. */
export default function ResponsiveDialog({ open, onClose, title, description, children, className, drawerClassName, hideHeader, compact, onClosed, onEscapeKeyDown, backEntry = true }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  // Phones: Back closes the drawer instead of lowering the sheet behind it. A dialog may refuse to close (e.g. while it
  // saves); Back has used up its history entry by then, so a fresh one is opened for the next Back press
  const id = useId();
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  const [backGeneration, setBackGeneration] = useState(0);
  useBackEntry(`dialog:${id}:${backGeneration}`, open && isMobile && backEntry, () => {
    onClose();
    setTimeout(() => {
      if (openRef.current) setBackGeneration((generation) => generation + 1);
    });
  });
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
          <Drawer.Content
            // Escape inside an inline editor cancels the edit instead of closing the drawer
            onEscapeKeyDown={keepOpenWhileEditing}
            // Same surface as the phone's bottom sheet (BottomSheet.tsx): 24px top corners, no border, soft upward shadow,
            // bg-beheer-window. Dialogs whose rows are tuned for the card (Account, Kaart & lagen, Meldingen) pass bg-card.
            className={cn('fixed inset-x-0 bottom-0 z-50 flex flex-col', compact ? 'max-h-[92dvh]' : 'h-[92dvh]', 'rounded-t-3xl border-0 bg-beheer-window shadow-[0_-6px_30px_rgb(0_0_0/.25)] outline-none', drawerClassName)}
          >
            <Drawer.Handle className="mx-auto mb-1 mt-2" />
            {/* Landscape phones: the sides clear the notch / rounded corners (safe areas), never less than the 16px gutter */}
            <div className={hideHeader ? 'sr-only' : 'pb-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[calc(max(1rem,env(safe-area-inset-right))+2.5rem)] pt-1'}>
              <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
              <Drawer.Description className="text-sm text-muted-foreground">{description}</Drawer.Description>
            </div>
            <div className="flex min-h-0 flex-1 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">{mounted && children}</div>
            {/* The handle is decorative (aria-hidden) and a swipe is no option for VoiceOver or an iOS PWA without Back:
                a visible close button, last in the DOM so opening still focuses the content first (as the desktop dialog does) */}
            <CloseButton onClick={onClose} className="absolute top-[18px] right-[max(1rem,env(safe-area-inset-right))]" />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          onEscapeKeyDown?.(event);
          if (!event.defaultPrevented) keepOpenWhileEditing(event);
        }}
        className={cn('flex max-h-[80dvh] flex-col gap-4 sm:max-w-4xl', !compact && 'h-[80dvh]', className)}>
        <DialogHeader className={cn(hideHeader && 'sr-only')}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {mounted && children}
      </DialogContent>
    </Dialog>
  );
}
