import { GlassesIcon, LocateFixedIcon, PinIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { MarkerType } from '@/types/MarkerType';
import { useId, useState } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { areaOptions, capitalizeFirstLetter, cn } from '@/lib/utils';
import { DIALOG_ACTION, DIALOG_ACTION_CANCEL, DIALOG_SHELL } from '@/lib/dialog-shell';
import { Controller, useForm } from 'react-hook-form';
import { fieldsResolver, oneOf, validDate } from '@/lib/form-resolver';
import { Field, FieldError, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { Marker } from '@/types/Marker';
import { useMarkers } from '@/hooks/markers.hook';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useEdition } from '@/hooks/edition.hook';
import {toast} from "sonner";
import { apiErrorMessage, isNetworkError } from '@/lib/api-error';
import { lostResponseOutcome, markerLostResponseMessage } from '@/lib/hint-submit';
import InlineError from '../InlineError';
import Reveal from '../motion/Reveal';
import { popupActionClass } from './popup/PopupActions';
import BusyIcon from '../motion/BusyIcon';
import useMarkerDraftStore, { draftForType } from '@/stores/marker-draft.store';
import { AnimatePresence, motion } from 'motion/react';
import { LAYOUT_SPRING, POP } from '@/lib/motion';
import { useWorkHold } from '@/stores/prompt-queue.store';
import { useIsMobile } from '@/hooks/media.hook';


type FormValues = { area: string; day: Date; time: Date };

/** "zaterdag 18 oktober" */
const formatDay = (day: Date) => day.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

const formResolver = fieldsResolver<FormValues>({
  area: oneOf(areaOptions.map((option) => option.value), 'Geen geldig deelgebied.'),
  day: validDate('Geen geldige dag.'),
  time: validDate('Geen geldige tijd.'),
});

/** Hunt / Spot buttons (fragment children, for inside `PopupActions`) plus the dialog to register a marker at this point. */
export default function MarkerRegistration({ lat, lng }: { lat: number; lng: number }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [markerType, setMarkerType] = useState<MarkerType>();
  const { createMarker, fetchFreshMarkers } = useMarkers();
  // A save that got no answer and couldn't be confirmed: kept (store) until confirmed or discarded, so closing the dialog
  // (or the popup) to look at the map doesn't lose it; shown above the buttons with "Opnieuw controleren"
  const storedDraft = useMarkerDraftStore((state) => state.draft);
  const pending = markerType === undefined ? null : draftForType(storedDraft, markerType);
  const lostMessage = pending ? markerLostResponseMessage(pending.outcome) : null;
  const [checking, setChecking] = useState(false);
  // Phones dock the popup with these buttons over the sheet: no follow-up prompt while it's open (the dialog holds itself)
  useWorkHold(useIsMobile());
  // An archive edition is read-only: no new markers
  const { readOnly } = useEdition();
  const fieldId = useId();
  // Before the hunt window is configured the pickers offer today and any time is accepted
  const { huntStart, huntEnd } = useAppConfig();
  const HUNT_START_TIME = huntStart ? new Date(huntStart) : new Date();
  const HUNT_END_TIME = huntEnd ? new Date(huntEnd) : new Date();

  const form = useForm<FormValues>({
    resolver: formResolver,
    defaultValues: freshValues(),
  });

  /** An empty form at the current (or first hunt) day and time */
  function freshValues(): FormValues {
    return { area: '', day: getCurrentOrFirstDate(), time: getCurrentOrFirstDate() };
  }

  /**
   * Get a list of all dates between the hunt start and end time.
   * Yes, you can also assume that the hunt starts on saterday and ends on sunday, but that'd be impractical for testing.
   * @returns A list of all dates between the hunt start and end time.
   */
  function getDays() {
    const days = [];
    const currentDate = new Date(HUNT_START_TIME);
    while (currentDate <= HUNT_END_TIME) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
  }

  /**
   * Get either the current date or the first hunt date if the current date is not within the hunt time.
   * @returns The date.
   */
  function getCurrentOrFirstDate() {
    const currentDay = new Date();
    if (currentDay < HUNT_START_TIME || currentDay > HUNT_END_TIME) {
      return HUNT_START_TIME;
    }
    return currentDay;
  }

  /**
   * Open a dialog to register a marker.
   * @param markerType What type of marker to open the dialog for.
   */
  function openDialog(markerType: MarkerType) {
    // An unconfirmed save of this type comes back as it was left; otherwise a fresh form (reset on open, not on close,
    // so the closing dialog doesn't flash empty fields)
    const draft = draftForType(useMarkerDraftStore.getState().draft, markerType);
    form.reset(draft ? { area: draft.area, day: draft.day, time: draft.time } : freshValues());
    setMarkerType(markerType);
    setDialogOpen(true);
  }

  /**
   * Close (or open) the dialog; an unconfirmed save keeps the values as last typed.
   * @param open Whether the dialog is open.
   */
  function handleOpenChange(open: boolean) {
    // While the marker is being saved or checked, Annuleren, Esc and the backdrop leave the dialog open
    if (!open && (form.formState.isSubmitting || checking)) return;
    if (!open && pending) {
      const { area, day, time } = form.getValues();
      useMarkerDraftStore.getState().update({ area, day, time });
    }
    setDialogOpen(open);
  }

  /** Opnieuw controleren: look for the unconfirmed marker in a fresh list, without leaving the dialog. */
  async function recheck() {
    if (!pending || checking) return;
    setChecking(true);
    const outcome = lostResponseOutcome(await fetchFreshMarkers(), pending.sent);
    setChecking(false);
    if (outcome === 'registered') {
      useMarkerDraftStore.getState().clear();
      setDialogOpen(false);
      toast.success('Marker geplaatst', { description: 'Bevestigd na verbindingsherstel.' });
      return;
    }
    useMarkerDraftStore.getState().update({ outcome });
    // Same answer as before: the line doesn't change, so say it once more
    if (outcome === 'unknown') toast.error('Nog steeds geen antwoord', { description: 'Controleer je verbinding en probeer het zo nog eens.' });
  }

  /** Verwerpen: forget the unconfirmed save and start from an empty form. */
  function discardDraft() {
    useMarkerDraftStore.getState().clear();
    form.reset(freshValues());
    // The buttons that had focus fold away
    document.getElementById(`${fieldId}-area`)?.focus();
  }

  /**
   * Submit the form data to create a marker.
   * @param data The form data.
   * @returns Absolutely nothing :)
   */
  async function onSubmit(data: FormValues) {
    const day = new Date(data.day);
    const time = new Date(data.time);
    const newDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());

    if (markerType === undefined) return;

    // Check if within the hunt time
    if (huntStart && huntEnd && (newDate < HUNT_START_TIME || newDate > HUNT_END_TIME)) {
      form.setError('time', { message: 'Tijd valt buiten de hunt periode.' });
      return;
    }

    const marker: Marker = {
      area: data.area,
      time: newDate,
      type: markerType,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    };

    const error = await createMarker(marker);
    if (error && isNetworkError(error)) {
      // No answer (offline, timeout) doesn't mean it failed: the server may have saved it. A fresh list tells.
      const outcome = lostResponseOutcome(await fetchFreshMarkers(), marker);
      if (outcome !== 'registered') {
        useMarkerDraftStore.getState().keep({ type: markerType, area: data.area, day, time, sent: marker, outcome });
        return;
      }
    } else if (error) {
      // The server's message for e.g. a 429 (too many markers in a row)
      toast.error('Marker plaatsen is mislukt', { description: apiErrorMessage(error, 'Probeer het opnieuw.') });
      return;
    }
    if (pending) useMarkerDraftStore.getState().clear();
    setDialogOpen(false);
    toast.success('Marker geplaatst');
  }

  const { isSubmitting } = form.formState;

  const renderForm = () => (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-4">
        <div className="flex gap-4 w-full">
          <Controller
            control={form.control}
            name="area"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${fieldId}-area`}>Deelgebied</FieldLabel>
                <Select name={field.name} onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id={`${fieldId}-area`} className="w-full pointer-coarse:data-[size=default]:h-11" aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Kies deelgebied..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {areaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        {/* Stacked on a phone; side by side once both fit (the day truncates rather than pushing the time out) */}
        <div className="grid w-full grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          {/* Select with all days */}
          <Controller
            control={form.control}
            name="day"
            render={({ field, fieldState }) => {
              const dateValue = field.value instanceof Date ? field.value : new Date(field.value); // Ensure it's a Date
              return (
                <Field data-invalid={fieldState.invalid} className="min-w-0">
                  <FieldLabel htmlFor={`${fieldId}-day`}>Dag</FieldLabel>
                  <Select name={field.name} onValueChange={(value) => field.onChange(new Date(value))} value={dateValue.toDateString()}>
                    <SelectTrigger
                      id={`${fieldId}-day`}
                      className="w-full min-w-0 pointer-coarse:data-[size=default]:h-11 *:data-[slot=select-value]:min-w-0"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="Kies dag...">
                        <span className="min-w-0 truncate">{formatDay(dateValue)}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {getDays().map((day) => (
                          <SelectItem key={day.toDateString()} value={day.toDateString()}>
                            {formatDay(day)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              );
            }}
          />
          {/* Time select input */}
          <Controller
            control={form.control}
            name="time"
            render={({ field, fieldState }) => {
              const timeValue =
                field.value instanceof Date
                  ? field.value.toTimeString().substring(0, 5) // Convert Date to HH:MM format
                  : ''; // Ensure it's a time string in HH:MM

              return (
                <Field data-invalid={fieldState.invalid} className="min-w-0">
                  <FieldLabel htmlFor={`${fieldId}-time`}>Tijd</FieldLabel>
                  <Input
                    id={`${fieldId}-time`}
                    type="time"
                    value={timeValue}
                    aria-invalid={fieldState.invalid}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const updatedDate = new Date(field.value);
                      updatedDate.setHours(parseInt(hours, 10));
                      updatedDate.setMinutes(parseInt(minutes, 10));
                      field.onChange(updatedDate); // Update the form field value with the selected time
                    }}
                    className="w-full border p-2 pointer-coarse:h-11"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              );
            }}
          />
        </div>
        <Reveal gap={16}>
          {lostMessage && (
            <div className="flex flex-col gap-2">
              <InlineError role="alert">{lostMessage}</InlineError>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {pending?.outcome === 'unknown' && (
                    <motion.div key="recheck" {...POP}>
                      <Button type="button" variant="outline" size="sm" className="pointer-coarse:h-11" disabled={checking || isSubmitting} aria-busy={checking} onClick={recheck}>
                        <BusyIcon busy={checking} icon={<RefreshCwIcon data-icon="inline-start" />} />
                        Opnieuw controleren
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div layout="position" transition={LAYOUT_SPRING}>
                  <Button type="button" variant="ghost" size="sm" className="pointer-coarse:h-11" disabled={checking || isSubmitting} onClick={discardDraft}>
                    Verwerpen
                  </Button>
                </motion.div>
              </div>
            </div>
          )}
        </Reveal>
        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" className={DIALOG_ACTION_CANCEL} disabled={isSubmitting || checking} onClick={() => handleOpenChange(false)}>
            Annuleren
          </Button>
          <Button variant="default" type="submit" className={DIALOG_ACTION} disabled={!form.formState.isValid || readOnly || isSubmitting || checking} aria-busy={isSubmitting}>
            <BusyIcon busy={isSubmitting} icon={<PinIcon data-icon="inline-start" />} />
            {isSubmitting ? 'Opslaan…' : 'Opslaan'}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  );

  const dialog = () => (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, 'bg-card')}>
        <DialogHeader>
          <DialogTitle>{capitalizeFirstLetter(markerType ?? '')} registreren</DialogTitle>
          <DialogDescription>Plaats een marker op de kaart.</DialogDescription>
        </DialogHeader>
        {renderForm()}
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {dialog()}
      <button type="button" className={popupActionClass('primary', 'min-w-0 flex-1')} disabled={readOnly} onClick={() => openDialog(MarkerType.Hunt)}>
        <LocateFixedIcon /> Hunt
      </button>
      <button type="button" className={popupActionClass('primary', 'min-w-0 flex-1')} disabled={readOnly} onClick={() => openDialog(MarkerType.Spot)}>
        <GlassesIcon /> Spot
      </button>
    </>
  );
}
