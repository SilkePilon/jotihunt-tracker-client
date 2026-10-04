import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from './ui/dialog';
import PropTypes, { InferProps } from 'prop-types';
import PasswordChangeForm from './PasswordChangeForm';

/** Change the own password from the settings menu. A forced change (admin-set password) is PasswordChangeGate. */
export default function ResetPassword({ open, setIsOpen, allowClose = true }: InferProps<typeof ResetPassword.propTypes>) {
  function handleOpenChange(open: boolean) {
    if (!allowClose || !setIsOpen) return;
    setIsOpen(open);
  }

  function handleInteractOutside(e: PointerDownOutsideEvent | FocusOutsideEvent) {
    if (!allowClose) e.preventDefault();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent onInteractOutside={handleInteractOutside} showCloseButton={allowClose}>
          <DialogHeader>
            <DialogTitle>Wachtwoord wijzigen</DialogTitle>
            <DialogDescription>{allowClose ? 'Vul je oude en nieuw wachtwoord in.' : 'Je bent verplicht je wachtwoord te wijzigen. Vul je oude en een nieuw wachtwoord in.'}</DialogDescription>
          </DialogHeader>
          {/* The dialog content unmounts when closed, so a reopened dialog starts empty */}
          <PasswordChangeForm onSuccess={() => setIsOpen?.(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

ResetPassword.propTypes = {
  open: PropTypes.bool.isRequired,
  setIsOpen: PropTypes.func,
  allowClose: PropTypes.bool.isRequired,
};

type PointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>;
type FocusOutsideEvent = CustomEvent<{ originalEvent: FocusEvent }>;
