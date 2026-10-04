import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { toast } from 'sonner';
import { Field, FieldError, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useAuth } from '@/hooks/auth.hook';

const passwordChangeSchema = z
  .object({
    oldPassword: z.string().min(1, 'Oude wachtwoord mag niet leeg zijn.'),
    newPassword: z.string().min(1, 'Nieuw wachtwoord mag niet leeg zijn.'),
    confirmPassword: z.string().min(1, 'Nieuw wachtwoord bevestiging mag niet leeg zijn.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Wachtwoorden komen niet overeen',
    path: ['confirmPassword'],
  });

/** Old + new password form; on success the session continues with the fresh token (see useAuth().updatePassword). */
export default function PasswordChangeForm({ onSuccess }: { onSuccess?: () => void }) {
  const auth = useAuth();
  const fieldId = useId();

  const form = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function handleUpdatePassword(data: z.infer<typeof passwordChangeSchema>) {
    const result = await auth.updatePassword(data.oldPassword, data.newPassword);

    if (result === 'wrong-password') {
      form.setError('oldPassword', { message: 'Oud wachtwoord is onjuist.' });
      return;
    }
    if (result === 'failed') {
      form.setError('root.serverError', { message: 'Wachtwoord wijzigen is mislukt. Controleer je verbinding en probeer het opnieuw.' });
      return;
    }

    form.reset();
    onSuccess?.();
    toast.success('Wachtwoord bijgewerkt!', {
      description: 'Je wachtwoord is succesvol aangepast.'
    });
  }

  return (
    <form onSubmit={form.handleSubmit(handleUpdatePassword)}>
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="oldPassword"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${fieldId}-oldPassword`}>Oude wachtwoord</FieldLabel>
              <Input {...field} id={`${fieldId}-oldPassword`} type="password" autoComplete="current-password" required aria-invalid={fieldState.invalid} />
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
              <Input {...field} id={`${fieldId}-newPassword`} type="password" autoComplete="new-password" required aria-invalid={fieldState.invalid} />
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
              <Input {...field} id={`${fieldId}-confirmPassword`} type="password" autoComplete="new-password" required aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {form.formState.errors.root?.serverError && <FieldError errors={[form.formState.errors.root.serverError]} />}
        <Button type="submit" disabled={form.formState.isSubmitting}>Wachtwoord wijzigen</Button>
      </FieldGroup>
    </form>
  );
}
