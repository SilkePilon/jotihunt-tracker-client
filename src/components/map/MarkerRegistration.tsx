import { CrosshairIcon, GlassesIcon, InfoIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { MarkerType } from '@/types/MarkerType';
import { type ReactNode, useId, useRef, useState } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import AreaPicker from '../cards/hint-entry/AreaPicker';
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
import useMarkerDraftStore, { draftElsewhere, draftKey, keyOfDraft, sameMarkerValues, type MarkerDraft, type MarkerDraftValues } from '@/stores/marker-draft.store';
import { AnimatePresence, motion } from 'motion/react';
import { SWAP } from '@/lib/motion';
import { useWorkHold } from '@/stores/prompt-queue.store';
import { useIsMobile } from '@/hooks/media.hook';
import ResponsiveDialog from '../ResponsiveDialog';
import ConfirmDialog from '../ConfirmDialog';
import { rdText } from '@/lib/rd';
import { timeInputValue, withTimeOfDay } from '@/lib/time-input';


type FormValues = { area: string; day: Date; time: Date };

/** "zaterdag 18 oktober" */
const formatDay = (day: Date) => day.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

/** "RD 187654, 432101" for a kept draft's pin */
const draftPlace = (draft: MarkerDraft) => {
  const [lng, lat] = draft.sent.location.coordinates;
  const rd = rdText(lng, lat);
  return `RD ${rd.x}, ${rd.y}`;
};

/** The values a draft's marker was sent with (its `area/day/time` follow the form when the dialog closes) */
const sentValues = (draft: MarkerDraft): MarkerDraftValues => ({ area: draft.sent.area, day: draft.sent.time, time: draft.sent.time });

/** A dashed info line above the fields (like the HQ line in Meldingen) */
const NOTE = 'flex items-start gap-2 rounded-[14px] border border-dashed px-3 py-2.5 text-xs text-muted-foreground';

const formResolver = fieldsResolver<FormValues>({
  area: oneOf(areaOptions.map((option) => option.value), 'Geen geldig deelgebied.'),
  day: validDate('Geen geldige dag.'),
  time: validDate('Geen geldige tijd.'),
});

/** Hunt / Spot buttons (fragment children, for inside `PopupActions`) plus the dialog to register a marker at this point. */
export default function MarkerRegistration({ lat, lng }: { lat: number; lng: number }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [markerType, setMarkerType] = useState<MarkerType>();
  // The pin the dialog registers at: this popup's point, or another pin's unconfirmed save picked up with "Hervat"
  const [target, setTarget] = useState({ lat, lng });
  const { createMarker, fetchFreshMarkers } = useMarkers();
  // A save that got no answer and couldn't be confirmed: kept (store, per type and pin) until confirmed or discarded, so
  // closing the dialog (or the popup) to look at the map doesn't lose it; shown above the buttons
  const drafts = useMarkerDraftStore((state) => state.drafts);
  const key = markerType === undefined ? null : draftKey(markerType, target.lat, target.lng);
  const pending = key === null ? null : (drafts[key] ?? null);
  // An unconfirmed save of this type at another pin: named (not restored here), so it isn't silently forgotten
  const elsewhere = markerType === undefined || key === null || pending ? null : draftElsewhere(drafts, markerType, key);
  // "Hervat" moved the dialog to another pin: say where it registers now
  const resumed = target.lat === lat && target.lng === lng ? null : (() => {
    const rd = rdText(target.lng, target.lat);
    return `RD ${rd.x}, ${rd.y}`;
  })();
  const lostMessage = pending ? markerLostResponseMessage(pending.outcome) : null;
  const [checking, setChecking] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Verwerpen folds away with the draft: focus goes to the first field instead of back to it
  const discardedRef = useRef(false);
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
    // An unconfirmed save of this type at this pin comes back as it was left; otherwise a fresh form (reset on open, not
    // on close, so the closing dialog doesn't flash empty fields)
    const draft = useMarkerDraftStore.getState().drafts[draftKey(markerType, lat, lng)];
    form.reset(draft ? { area: draft.area, day: draft.day, time: draft.time } : freshValues());
    setTarget({ lat, lng });
    setMarkerType(markerType);
    setDialogOpen(true);
  }

  /** Hervat: switch the dialog to the unconfirmed save at another pin, with its values. */
  function resumeElsewhere(draft: MarkerDraft) {
    const [draftLng, draftLat] = draft.sent.location.coordinates;
    form.reset({ area: draft.area, day: draft.day, time: draft.time });
    setTarget({ lat: draftLat, lng: draftLng });
  }

  /** Keep the values as last typed with an unconfirmed save. */
  function keepTyped() {
    if (!pending || key === null) return;
    const { area, day, time } = form.getValues();
    useMarkerDraftStore.getState().update(key, { area, day, time });
  }

  /** Close the dialog; an unconfirmed save keeps the values as last typed. */
  function close() {
    // While the marker is being saved or checked, Annuleren, Esc, Back and the backdrop leave the dialog open
    // (ResponsiveDialog then re-arms Back for the next press)
    if (form.formState.isSubmitting || checking) return;
    keepTyped();
    setDialogOpen(false);
  }

  /** Opnieuw controleren: look for the unconfirmed marker in a fresh list, without leaving the dialog. */
  async function recheck() {
    if (!pending || key === null || checking) return;
    setChecking(true);
    const outcome = lostResponseOutcome(await fetchFreshMarkers(), pending.sent);
    setChecking(false);
    if (outcome === 'registered') {
      useMarkerDraftStore.getState().clear(key);
      // Values changed since that save (a correction or a next marker): confirm the old one, keep the new values open
      if (!sameMarkerValues(form.getValues(), sentValues(pending))) {
        toast.success('Vorige marker geplaatst — je nieuwe invoer is nog niet opgeslagen', { description: 'Bevestigd na verbindingsherstel.', duration: 10000 });
        return;
      }
      setDialogOpen(false);
      toast.success('Marker geplaatst', { description: 'Bevestigd na verbindingsherstel.' });
      return;
    }
    useMarkerDraftStore.getState().update(key, { outcome });
    // Same answer as before: the line doesn't change, so say it once more
    if (outcome === 'unknown') toast.error('Nog steeds geen antwoord', { description: 'Controleer je verbinding en probeer het zo nog eens.' });
  }

  /** Verwerpen (after ConfirmDialog): forget the unconfirmed save and start from an empty form. */
  function discardDraft() {
    if (key !== null) useMarkerDraftStore.getState().clear(key);
    form.reset(freshValues());
    discardedRef.current = true;
    setConfirmDiscard(false);
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

    if (markerType === undefined || key === null) return;

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
        coordinates: [target.lng, target.lat],
      },
    };

    const error = await createMarker(marker);
    let confirmedLate = false;
    if (error && isNetworkError(error)) {
      // No answer (offline, timeout) doesn't mean it failed: the server may have saved it. A fresh list tells.
      const outcome = lostResponseOutcome(await fetchFreshMarkers(), marker);
      if (outcome !== 'registered') {
        const typed = form.getValues();
        const draft: MarkerDraft = { type: markerType, area: data.area, day, time, sent: marker, outcome };
        useMarkerDraftStore.getState().keep(draft);
        // Values typed while it ran stay in the form and in the kept draft
        useMarkerDraftStore.getState().update(keyOfDraft(draft), { area: typed.area, day: typed.day, time: typed.time });
        return;
      }
      confirmedLate = true;
    } else if (error) {
      // The server's message for e.g. a 429 (too many markers in a row)
      toast.error('Marker plaatsen is mislukt', { description: apiErrorMessage(error, 'Probeer het opnieuw.') });
      return;
    }
    useMarkerDraftStore.getState().clear(key);
    const lateNote = confirmedLate ? 'Bevestigd na verbindingsherstel.' : undefined;
    // A correction or a next marker was typed while Registreren ran: confirm this one, leave the new values and the dialog
    if (!sameMarkerValues(form.getValues(), data)) {
      toast.success('Vorige marker geplaatst — je nieuwe invoer is nog niet opgeslagen', { description: lateNote, duration: 10000 });
      return;
    }
    setDialogOpen(false);
    toast.success('Marker geplaatst', { description: lateNote });
  }

  const { isSubmitting } = form.formState;
  // No answer and not confirmed: saving again could place it twice, so checking is the main action until a fresh list
  // says it isn't there ('absent': save again)
  const primary = pending?.outcome === 'unknown' ? 'recheck' : pending ? 'resave' : 'save';
  const busy = isSubmitting || checking;

  const renderForm = () => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      {/* Short windows and a phone keyboard: the fields scroll, Annuleren/Registreren stay in view. The 4px inset keeps the
          fields' focus rings inside the scroll clip */}
      <div className="-m-1 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
        <FieldGroup className="gap-4">
          <Reveal gap={16}>
            {elsewhere && (
              <div className={NOTE}>
                <InfoIcon className="mt-px size-4 shrink-0" aria-hidden />
                <p className="flex-1">
                  Er wacht nog een niet-bevestigde {elsewhere.type} bij {draftPlace(elsewhere)}. Die staat hier niet ingevuld.
                </p>
                <Button type="button" variant="ghost" size="sm" className="-my-1.5 h-8 shrink-0 rounded-lg pointer-coarse:h-11" disabled={busy} onClick={() => resumeElsewhere(elsewhere)}>
                  Hervat
                </Button>
              </div>
            )}
          </Reveal>
          <Reveal gap={16}>
            {resumed && (
              <p className={cn(NOTE, 'items-center')}>
                <InfoIcon className="size-4 shrink-0" aria-hidden />
                Je werkt nu aan de pin van je niet-bevestigde {markerType} bij {resumed}.
              </p>
            )}
          </Reveal>
          <div className="flex gap-4 w-full">
            <Controller
              control={form.control}
              name="area"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${fieldId}-area`}>Deelgebied</FieldLabel>
                  {/* The hint form's 3×3 area tiles in their map colours, so both forms pick an area the same way */}
                  <AreaPicker
                    id={`${fieldId}-area`}
                    value={field.value}
                    onChange={(area) => {
                      field.onChange(area);
                      field.onBlur();
                    }}
                    invalid={fieldState.invalid}
                    placeholder="Kies deelgebied…"
                    className="h-9 text-sm pointer-coarse:h-11"
                  />
                  <Reveal>{fieldState.invalid && <FieldError errors={[fieldState.error]} />}</Reveal>
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
                        <SelectValue placeholder="Kies dag…">
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
                return (
                  <Field data-invalid={fieldState.invalid} className="min-w-0">
                    <FieldLabel htmlFor={`${fieldId}-time`}>Tijd</FieldLabel>
                    <Input
                      id={`${fieldId}-time`}
                      type="time"
                      value={timeInputValue(field.value)}
                      aria-invalid={fieldState.invalid}
                      onChange={(e) => {
                        // A cleared or half-typed field is no time (not setHours(NaN) on the last one, which stuck): the
                        // next complete value builds from a valid date again
                        field.onChange(withTimeOfDay(field.value, e.target.value, getCurrentOrFirstDate()));
                        // Said right away, not only after Registreren
                        void form.trigger('time');
                      }}
                      className="w-full pointer-coarse:h-11"
                    />
                    <Reveal>{fieldState.invalid && <FieldError errors={[fieldState.error]} />}</Reveal>
                  </Field>
                );
              }}
            />
          </div>
          <Reveal gap={16}>
            {lostMessage && (
              <div className="flex flex-col items-start gap-2">
                <InlineError role="alert">{lostMessage}</InlineError>
                <Button type="button" variant="ghost" size="sm" className="pointer-coarse:h-11" disabled={busy} onClick={() => setConfirmDiscard(true)}>
                  Verwerpen
                </Button>
              </div>
            )}
          </Reveal>
        </FieldGroup>
      </div>
      {/* Phones: side by side at full width (like Meldingen); desktop: right-aligned */}
      <div className="mt-4 flex shrink-0 gap-2 *:flex-1 sm:justify-end sm:*:flex-none">
        <Button variant="outline" type="button" className={cn(DIALOG_ACTION_CANCEL, 'pointer-coarse:h-11')} disabled={busy} onClick={close}>
          Annuleren
        </Button>
        {/* One button whose action follows the state, so its label swaps instead of a new button popping in */}
        <Button
          variant="default"
          type={primary === 'recheck' ? 'button' : 'submit'}
          onClick={primary === 'recheck' ? recheck : undefined}
          className={cn(DIALOG_ACTION, 'pointer-coarse:h-11')}
          disabled={busy || (primary !== 'recheck' && (!form.formState.isValid || readOnly))}
          aria-busy={busy}
        >
          <PrimaryLabel id={primary}>
            {primary === 'recheck' ? (
              <>
                <BusyIcon busy={checking} icon={<RefreshCwIcon data-icon="inline-start" />} />
                Opnieuw controleren
              </>
            ) : (
              <>
                <BusyIcon busy={isSubmitting} icon={markerType === MarkerType.Spot ? <GlassesIcon data-icon="inline-start" /> : <CrosshairIcon data-icon="inline-start" />} />
                {isSubmitting ? 'Registreren…' : primary === 'resave' ? 'Opnieuw registreren' : 'Registreren'}
              </>
            )}
          </PrimaryLabel>
        </Button>
      </div>
    </form>
  );

  return (
    <>
      <ResponsiveDialog
        open={dialogOpen}
        onClose={close}
        title={`${capitalizeFirstLetter(markerType ?? '')} registreren`}
        description={markerType === MarkerType.Spot ? 'Je hebt de vos hier gezien.' : 'Eigen markering op de kaart. Officiële hunts komen vanzelf binnen van jotihunt.nl.'}
        compact
        className={cn(DIALOG_SHELL, 'bg-card sm:max-w-lg')}
        drawerClassName="bg-card"
      >
        {renderForm()}
      </ResponsiveDialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Niet-bevestigde marker verwerpen?"
        description="Je invoer wordt gewist. Als de server de marker toch al heeft opgeslagen, blijft die gewoon op de kaart staan; verwijder hem daar als dat nodig is."
        cancelLabel="Bewaren"
        confirmLabel="Verwerpen"
        destructive
        onConfirm={discardDraft}
        onCloseAutoFocus={(event) => {
          if (!discardedRef.current) return;
          // The Verwerpen button folded away with the draft: continue at the first field
          discardedRef.current = false;
          event.preventDefault();
          document.getElementById(`${fieldId}-area`)?.focus();
        }}
      />
      <button type="button" className={popupActionClass('primary', 'min-w-0 flex-1')} disabled={readOnly} onClick={() => openDialog(MarkerType.Hunt)}>
        <CrosshairIcon /> Hunt
      </button>
      {/* Hunt is the main action (soft primary); Spot the neutral tonal one, so the two read apart at a glance */}
      <button type="button" className={popupActionClass('neutral', 'min-w-0 flex-1')} disabled={readOnly} onClick={() => openDialog(MarkerType.Spot)}>
        <GlassesIcon /> Spot
      </button>
    </>
  );
}

/** The primary footer button's icon and label: swaps with a short fade when the action changes (Registreren / controleren) */
function PrimaryLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={id} {...SWAP} className="inline-flex items-center gap-1.5">
        {children}
      </motion.span>
    </AnimatePresence>
  );
}
