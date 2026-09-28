import { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/media.hook';

interface AdminShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}

/** Frame shared by the admin dialogs: a large dialog on desktop, a bottom drawer on phones. */
export default function AdminShell({ open, onClose, title, description, children }: AdminShellProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] flex-col rounded-t-2xl border-t bg-background outline-none">
            <Drawer.Handle className="mx-auto mb-1 mt-2" />
            <div className="px-4 pb-3 pt-1">
              <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
              <Drawer.Description className="text-sm text-muted-foreground">{description}</Drawer.Description>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{open && children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[80dvh] max-h-[80dvh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && children}
      </DialogContent>
    </Dialog>
  );
}
