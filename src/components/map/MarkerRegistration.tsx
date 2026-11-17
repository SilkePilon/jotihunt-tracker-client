import { CrosshairIcon, GlassesIcon, InfoIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { MarkerType } from '@/types/MarkerType';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import AreaPicker from '../cards/hint-entry/AreaPicker';
import { areaOptions, capitalizeFirstLetter, cn } from '@/lib/utils';
import { DIALOG_ACTION, DIALOG_ACTION_CANCEL, DIALOG_SHELL } from '@/lib/dialog-shell';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { fieldsResolver, oneOf, validDate } from '@/lib/form-resolver';
import { Field, FieldError, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { Marker } from '@/types/Marker';
import { useMarkers } from '@/hooks/markers.hook';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useEdition } from '@/hooks/edition.hook';
import {toast} from "sonner";
import { apiErrorMessage, isNetworkError } from '@/lib/api-error';
import { checkJustLost, isKnownOffline, markerLostResponseMessage, OFFLINE_NOT_SENT_MESSAGE, recheckLost } from '@/lib/hint-submit';
import InlineError from '../InlineError';
import Reveal from '../motion/Reveal';
import { popupActionClass } from './popup/PopupActions';
import BusyIcon from '../motion/BusyIcon';
import { ERROR_TOAST_MS, huntDays, markerMissingPick, markerNoun, markerSaveLabel, markerSavedToast, markerVerb } from '@/lib/markers';
import useMarkerDraftStore, { draftElsewhere, draftKey, keyOfDraft, sameMarkerValues, type MarkerDraft, type MarkerDraftValues } from '@/stores/marker-draft.store';
import useFollowMeStore from '@/stores/follow-me.store';
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

/** "RD 187654, 432101" for a pin */
const rdPlace = (lng: number, lat: number) => {
  const rd = rdText(lng, lat);
  return `RD ${rd.x}, ${rd.y}`;
};

/** "RD 187654, 432101" for a kept draft's pin */
const draftPlace = (draft: MarkerDraft) => {
  const [lng, lat] = draft.sent.location.coordinates;
  return rdPlace(lng, lat);
};

/** The values a draft's marker was sent with (its `area/day/time` follow the form when the dialog closes) */
const sentValues = (draft: MarkerDraft): MarkerDraftValues => ({ area: draft.sent.area, day: draft.sent.time, time: draft.sent.time });

/** A dashed info line above the fields (like the HQ line in Meldingen) */
const NOTE = 'flex items-start gap-2 rounded-(--radius-tile) border border-dashed px-3 py-2.5 text-xs text-muted-foreground';

/** The Hunt button's full name and the Hunt dialog's title: it marks our own hunt on the map */
const HUNT_ACTION_LABEL = 'Hunt markeren op kaart';

const AREA_VALUES = areaOptions.map((option) => option.value);

const formResolver = fieldsResolver<FormValues>({
  area: oneOf(AREA_VALUES, 'Geen geldig deelgebied.'),
  day: validDate('Geen geldige dag.'),
  time: validDate('Geen geldige tijd.'),
});

interface MarkerRegistrationProps {
  lat: number;
  lng: number;
  /** Fires once the dialog has closed (its exit animation done) after a successful save */
  onRegistered?: () => void;
  /** MarkerRegistrationHost: no Hunt / Spot buttons; each new store request (requestOpen) opens the dialog at its pin */
  hosted?: boolean;
}

/**
 * Hunt / Spot buttons (fragment children, for inside `PopupActions`) plus the dialog to register a marker at this point.
 * `onRegistered` fires once the dialog has closed (its exit animation done) after a successful save, e.g. to close a
 * popup whose only job was this point. `hosted` (MarkerRegistrationHost): no buttons, each new request opens the
 * dialog.
 */
export default function MarkerRegistration({ lat, lng, onRegistered, hosted = false }: MarkerRegistrationProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [markerType, setMarkerType] = useState<MarkerType>();
  // The pin the dialog registers at: this popup's point, or another pin's unconfirmed save picked up with "Hervat"
  const [target, setTarget] = useState({ lat, lng });
  const { createMarker, fetchFreshMarkers } = useMarkers();
  // A save that got no answer and couldn't be confirmed: kept (store, per type and pin) until confirmed or discarded, so
  // closing the dialog (or the popup) to look at the map doesn't lose it; shown above the buttons
  const drafts = useMarkerDraftStore((state) => state.drafts);
  // The area the last Hunt/Spot went to: the form starts there, marked "(vorige)" while it still shows
  const lastArea = useMarkerDraftStore((state) => state.lastArea);
  // "Hunt" / "Spot" in the toasts; a Hunt is marked, a Spot registered
  const noun = markerNoun(markerType ?? MarkerType.Hunt);
  const verb = markerVerb(markerType ?? MarkerType.Hunt);
  const key = markerType === undefined ? null : draftKey(markerType, target.lat, target.lng);
  const pending = key === null ? null : (drafts[key] ?? null);
  // An unconfirmed save of this type at another pin: named (not restored here), so it isn't silently forgotten
  const elsewhere = markerType === undefined || key === null || pending ? null : draftElsewhere(drafts, markerType, key);
  // "Hervat" moved the dialog to another pin: where it registers now. Set by resumeElsewhere only, not by comparing with
  // the props (a hunter's popup passes its live position, which moves on while the dialog is open)
  const [resumed, setResumed] = useState<string | null>(null);
  const lostMessage = pending ? (pending.notSent ? OFFLINE_NOT_SENT_MESSAGE : markerLostResponseMessage(pending.outcome, pending.type)) : null;
  const [checking, setChecking] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Verwerpen folds away with the draft: focus goes to the first field instead of back to it
  const discardedRef = useRef(false);
  // The dialog closed because the marker was registered: onRegistered once it has slid / faded out
  const registeredRef = useRef(false);
  // Phones dock the popup with these buttons over the sheet: no follow-up prompt while it's open (the dialog holds itself)
  useWorkHold(useIsMobile() && !hosted);
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

  /** A fresh form at the current (or first hunt) day and time; Deelgebied starts at the last one sent (still changeable) */
  function freshValues(): FormValues {
    const { lastArea } = useMarkerDraftStore.getState();
    const area = areaOptions.some((option) => option.value === lastArea) ? lastArea : '';
    return { area, day: getCurrentOrFirstDate(), time: getCurrentOrFirstDate() };
  }

  /** Every hunt day for the day picker (the last day too when the hunt ends earlier in the day than it started) */
  function getDays() {
    return huntDays(HUNT_START_TIME, HUNT_END_TIME);
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
   * @param at The pin (default: this popup's point)
   */
  function openDialog(markerType: MarkerType, at: { lat: number; lng: number } = { lat, lng }) {
    // An unconfirmed save of this type at this pin comes back as it was left; otherwise a fresh form (reset on open, not
    // on close, so the closing dialog doesn't flash empty fields)
    const draft = useMarkerDraftStore.getState().drafts[draftKey(markerType, at.lat, at.lng)];
    const values = draft ? { area: draft.area, day: draft.day, time: draft.time } : freshValues();
    form.reset(values);
    // reset() doesn't recompute isValid for a filled form: check the (prefilled) area so Registreren is live right away
    if (values.area) void form.trigger('area');
    // A dialog over the map: following the own position would move the map under it (and the pin out of view)
    useFollowMeStore.getState().stop();
    setTarget({ lat: at.lat, lng: at.lng });
    setResumed(null);
    setMarkerType(markerType);
    registeredRef.current = false;
    setDialogOpen(true);
  }

  /** Hervat: switch the dialog to the unconfirmed save at another pin, with its values. */
  function resumeElsewhere(draft: MarkerDraft) {
    const [draftLng, draftLat] = draft.sent.location.coordinates;
    form.reset({ area: draft.area, day: draft.day, time: draft.time });
    setTarget({ lat: draftLat, lng: draftLng });
    setResumed(rdPlace(draftLng, draftLat));
  }

  // Hosted: each new request in the store opens the dialog at its pin
  const openRef = useRef(openDialog);
  useEffect(() => {
    openRef.current = openDialog;
  });
  useEffect(() => {
    if (!hosted) return;
    return useMarkerDraftStore.subscribe((state, previous) => {
      const { request } = state;
      if (request && request.id !== previous.request?.id) openRef.current(request.type, request);
    });
  }, [hosted]);

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
    if (!pending || key === null || checking || form.formState.isSubmitting) return;
    setChecking(true);
    const outcome = await recheckLost(fetchFreshMarkers, pending.sent, pending.lostAt);
    setChecking(false);
    if (outcome === 'registered') {
      useMarkerDraftStore.getState().clear(key);
      // Values changed since that save (a correction or a next marker): confirm the old one, keep the new values open
      if (!sameMarkerValues(form.getValues(), sentValues(pending))) {
        toast.success(`Vorige ${noun.toLowerCase()} ${verb.past} — je nieuwe invoer is nog niet opgeslagen`, { description: 'Bevestigd na verbindingsherstel.', duration: 10000 });
        return;
      }
      registeredRef.current = true;
      setDialogOpen(false);
      toast.success(markerSavedToast(pending.type), { description: 'Bevestigd na verbindingsherstel.' });
      return;
    }
    useMarkerDraftStore.getState().update(key, { outcome });
    // Same answer as before: the line doesn't change, so say it once more
    if (outcome === 'unknown') toast.error('Nog steeds geen antwoord', { description: 'Controleer je verbinding en probeer het zo nog eens.', duration: ERROR_TOAST_MS });
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
      form.setError('time', { message: 'Tijd valt buiten de huntperiode.' });
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

    // The next Hunt/Spot (often the same team) starts at this area
    useMarkerDraftStore.getState().rememberArea(data.area);
    // Known offline: don't send (it can't arrive), keep the input with an 'absent' draft so "Opnieuw …" leads and the
    // peek strip / sidebar keep naming it
    if (isKnownOffline()) {
      const typed = form.getValues();
      const draft: MarkerDraft = { type: markerType, area: data.area, day, time, sent: marker, outcome: 'absent', notSent: true };
      useMarkerDraftStore.getState().keep(draft);
      useMarkerDraftStore.getState().update(keyOfDraft(draft), { area: typed.area, day: typed.day, time: typed.time });
      return;
    }
    const error = await createMarker(marker);
    let confirmedLate = false;
    if (error && isNetworkError(error)) {
      // No answer (offline, timeout) doesn't mean it failed: the server may have saved it. A fresh list tells (the
      // button says "Controleren…" meanwhile). Right after the timeout a missing marker is 'unknown', not 'absent': the
      // POST may still land, so "Opnieuw controleren" leads instead of a second save
      setChecking(true);
      const { outcome, lostAt } = await checkJustLost(fetchFreshMarkers, marker);
      setChecking(false);
      if (outcome !== 'registered') {
        const typed = form.getValues();
        const draft: MarkerDraft = { type: markerType, area: data.area, day, time, sent: marker, outcome, lostAt };
        useMarkerDraftStore.getState().keep(draft);
        // Values typed while it ran stay in the form and in the kept draft
        useMarkerDraftStore.getState().update(keyOfDraft(draft), { area: typed.area, day: typed.day, time: typed.time });
        return;
      }
      confirmedLate = true;
    } else if (error) {
      // The server's message for e.g. a 429 (too many markers in a row)
      toast.error(`${noun} ${verb.infinitive} is mislukt`, { description: apiErrorMessage(error, 'Probeer het opnieuw.'), duration: ERROR_TOAST_MS });
      return;
    }
    useMarkerDraftStore.getState().clear(key);
    const lateNote = confirmedLate ? 'Bevestigd na verbindingsherstel.' : undefined;
    // A correction or a next marker was typed while Registreren ran: confirm this one, leave the new values and the dialog
    if (!sameMarkerValues(form.getValues(), data)) {
      toast.success(`Vorige ${noun.toLowerCase()} ${verb.past} — je nieuwe invoer is nog niet opgeslagen`, { description: lateNote, duration: 10000 });
      return;
    }
    registeredRef.current = true;
    setDialogOpen(false);
    toast.success(markerSavedToast(markerType), { description: lateNote });
  }

  const { isSubmitting } = form.formState;
  // No answer and not confirmed: saving again could place it twice, so checking is the main action until a fresh list
  // says it isn't there ('absent': save again)
  const primary = pending?.outcome === 'unknown' ? 'recheck' : pending ? 'resave' : 'save';
  const busy = isSubmitting || checking;
  // Why Registreren is greyed out, said under the buttons (the first missing pick); not for Opnieuw controleren
  const [areaValue, dayValue, timeValue] = useWatch({ control: form.control, name: ['area', 'day', 'time'] });
  const missing = primary === 'recheck' || readOnly ? null : markerMissingPick({ area: areaValue, day: dayValue, time: timeValue }, AREA_VALUES);
  const missingId = `${fieldId}-missing`;
  // The form starts at the last area ("(vorige)"): the button names it, so a wrong team is seen at the moment of saving
  const prefilledArea = primary !== 'recheck' && areaValue && areaValue === lastArea ? areaOptions.find((option) => option.value === areaValue)?.label : undefined;
  const saveLabel = markerSaveLabel(markerType ?? MarkerType.Hunt, { resave: primary === 'resave', area: prefilledArea });

  const renderForm = () => (
    <form
      onSubmit={(e) => {
        // Registreren is aria-disabled (not disabled) while busy, so Enter can still submit: ignore it
        if (busy) return e.preventDefault();
        return form.handleSubmit(onSubmit)(e);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
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
                    note={field.value && field.value === lastArea ? '(vorige)' : undefined}
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
                    <Reveal>{fieldState.invalid && <FieldError errors={[fieldState.error]} />}</Reveal>
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
      <Reveal>
        {missing && (
          <p id={missingId} className="pt-3 text-xs text-muted-foreground desk:text-right">
            {missing}
          </p>
        )}
      </Reveal>
      {/* Phones (landscape too): side by side at full width (like Meldingen), Registreren with two thirds for its area
          name; desktop: right-aligned */}
      <div className="mt-4 flex shrink-0 gap-2 desk:justify-end desk:*:flex-none">
        {/* aria-disabled, not disabled, while busy: disabling the focused button would drop the focus mid-save (close()
            ignores the press then, like the primary's handlers) */}
        <Button variant="outline" type="button" className={cn(DIALOG_ACTION_CANCEL, 'flex-1 pointer-coarse:h-11')} aria-disabled={busy || undefined} onClick={close}>
          Annuleren
        </Button>
        {/* One button whose action follows the state, so its label swaps instead of a new button popping in */}
        <Button
          variant="default"
          type={primary === 'recheck' ? 'button' : 'submit'}
          onClick={primary === 'recheck' ? recheck : undefined}
          // Busy (saving / checking): full colour with the spinner, not the greyed-out look of "can't press"
          className={cn(DIALOG_ACTION, 'min-w-0 flex-[2_1_0%] pointer-coarse:h-11 aria-busy:aria-disabled:opacity-100')}
          disabled={!busy && primary !== 'recheck' && (!!missing || !form.formState.isValid || readOnly)}
          aria-disabled={busy || undefined}
          aria-describedby={missing ? missingId : undefined}
          aria-busy={busy}
        >
          <PrimaryLabel id={`${primary}-${prefilledArea ?? ''}${isSubmitting && checking ? '-check' : ''}`}>
            {primary === 'recheck' ? (
              <>
                <BusyIcon busy={checking} icon={<RefreshCwIcon data-icon="inline-start" />} />
                Opnieuw controleren
              </>
            ) : (
              <>
                <BusyIcon busy={isSubmitting} icon={markerType === MarkerType.Spot ? <GlassesIcon data-icon="inline-start" /> : <CrosshairIcon data-icon="inline-start" />} />
                {/* Truncates rather than spilling out on the narrowest phones */}
                <span className="min-w-0 truncate">{isSubmitting ? (checking ? 'Controleren…' : verb.busy) : saveLabel}</span>
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
        onClosed={() => {
          if (!registeredRef.current) return;
          registeredRef.current = false;
          onRegistered?.();
        }}
        // A Hunt here is our own marking, not the official hunt (that comes in from jotihunt.nl): the title says so
        title={markerType === MarkerType.Hunt ? HUNT_ACTION_LABEL : `${capitalizeFirstLetter(markerType ?? '')} registreren`}
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
        title={`Niet-bevestigde ${noun.toLowerCase()} verwerpen?`}
        description={`Je invoer wordt gewist. Als de server de ${noun.toLowerCase()} toch al heeft opgeslagen, blijft die gewoon op de kaart staan; verwijder hem daar als dat nodig is.`}
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
      {!hosted && (
        <>
          <button type="button" className={popupActionClass('primary', 'min-w-0 flex-1')} disabled={readOnly} title={HUNT_ACTION_LABEL} aria-label={HUNT_ACTION_LABEL} onClick={() => openDialog(MarkerType.Hunt)}>
            <CrosshairIcon /> Hunt
          </button>
          {/* Hunt is the main action (soft primary); Spot the neutral tonal one, so the two read apart at a glance */}
          <button type="button" className={popupActionClass('neutral', 'min-w-0 flex-1')} disabled={readOnly} onClick={() => openDialog(MarkerType.Spot)}>
            <GlassesIcon /> Spot
          </button>
        </>
      )}
    </>
  );
}

/** The primary footer button's icon and label: swaps with a short fade when the action changes (Registreren / controleren) */
function PrimaryLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={id} {...SWAP} className="inline-flex min-w-0 items-center gap-1.5">
        {children}
      </motion.span>
    </AnimatePresence>
  );
}
