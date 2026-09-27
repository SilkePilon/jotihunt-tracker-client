import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from './ui/dialog';
import PropTypes, { InferProps } from 'prop-types';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field, FieldError, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useAuth } from '@/hooks/auth.hook';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { User } from '@/types/User';
import {toast} from "sonner";
import { useId } from 'react';

const resetPasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Oude wachtwoord mag niet leeg zijn.'),
    newPassword: z.string().min(1, 'Nieuw wachtwoord mag niet leeg zijn.'),
    confirmPassword: z.string().min(1, 'Nieuw wachtwoord bevestigeing mag niet leeg zijn.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Wachtwoorden komen niet overeen',
    path: ['confirmPassword'],
  });

export default function ResetPassword({ open, setIsOpen, allowClose = true }: InferProps<typeof ResetPassword.propTypes>) {
  const auth = useAuth();
  const authUser = useAuthUser<User>();
  const fieldId = useId();

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function handleUpdatePassword(data: z.infer<typeof resetPasswordSchema>) {
    const result = await auth.updatePassword(data.oldPassword, data.newPassword);

    if (!result) {
      form.setError('oldPassword', { message: 'Oud wachtwoord is onjuist.' });
      return;
    }

    if (!authUser) return;
    if (setIsOpen) setIsOpen(false);

    form.reset();

    const newUserState = { ...authUser, requiresPasswordChange: false };
    auth.updateUserState(newUserState);
    toast.success('Wachtwoord bijgewerkt!', {
      description: 'Je wachtwoord is succesvol aangepast.'
    });
  }

  function handleOpenChange(open: boolean) {
    if (!allowClose || !setIsOpen) return;
    setIsOpen(open);
    form.reset();
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
          <form onSubmit={form.handleSubmit(handleUpdatePassword)}>
            <FieldGroup className="gap-4">
              <Controller
                control={form.control}
                name="oldPassword"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${fieldId}-oldPassword`}>Oude wachtwoord</FieldLabel>
                    <Input {...field} id={`${fieldId}-oldPassword`} type="password" required aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="newPassword"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${fieldId}-newPassword`}>Nieuw wachtwoord</FieldLabel>
                    <Input {...field} id={`${fieldId}-newPassword`} type="password" required aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="confirmPassword"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${fieldId}-confirmPassword`}>Bevestig nieuw wachtwoord</FieldLabel>
                    <Input {...field} id={`${fieldId}-confirmPassword`} type="password" required aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Button type="submit">Wachtwoord wijzigen</Button>
            </FieldGroup>
          </form>
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
