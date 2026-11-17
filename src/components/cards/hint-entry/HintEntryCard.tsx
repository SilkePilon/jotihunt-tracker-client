import {Controller, useForm, useWatch} from 'react-hook-form';
import {Button} from '../../ui/button.tsx';
import {EraserIcon, Loader2Icon, Pin, RefreshCwIcon} from 'lucide-react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import InlineError from '@/components/InlineError';
import LoadError from '@/components/LoadError';
import Reveal from '@/components/motion/Reveal';
import ArchiveReadOnlyNote from '@/components/ArchiveReadOnlyNote';
import {SWAP} from '@/lib/motion';
import useHintDraftStore, {EMPTY_HINT_DRAFT} from '@/stores/hint-draft.store';
import {useMarkers} from '@/hooks/markers.hook.ts';
import {toast} from 'sonner';
import {MapRef} from '@/components/Map.tsx';
import {MarkerType} from '@/types/MarkerType.ts';
import {Marker} from '@/types/Marker.ts';
import {areaOptions} from '@/lib/utils.ts';
import {useEffect, useId, useRef, useState} from "react";
import {useHintFormBridge} from "@/hooks/hint-bridge.hook.ts";
import {useAppConfig} from '@/hooks/app-config.hook';
import {useEdition} from '@/hooks/edition.hook';
import {isInNetherlands} from '@/lib/netherlands';
import {fromRD, isPlausibleRD} from '@/lib/rd';
import {apiErrorMessage, isNetworkError} from '@/lib/api-error';
import {hintPrimaryAction, holdsUnconfirmedHint, lostResponseMessage, lostResponseOutcome, sameDraft, type UnconfirmedHint} from '@/lib/hint-submit';
import AreaPicker from './AreaPicker';
import TimePicker from './TimePicker';
import DigitBoxes from './DigitBoxes';
import CoordinateStatus, {type CoordinateState} from './CoordinateStatus';
import {buildHintHours, groupByDay, isFreeHour, isTakenHour, missingPickText, previousHintText} from './hint-times';
import {formatClock} from '@/lib/format';
import {SOFT_PRIMARY_BUTTON} from '@/lib/tonal-button';
import {fieldsResolver, nonEmptyString, oneOf, stringOfLength} from '@/lib/form-resolver';
import {COARSE_HIT_AREA} from '@/lib/hit-area';
import {type GuessStatus, guessStatus, hasWildcard, parseGuess} from '@/lib/hint-guess';
import useHintGuessStore from '@/stores/hint-guess.store';
import useSidebarStore from '@/stores/sidebar.store';
import {useIsMobile} from '@/hooks/media.hook';

type FormValues = {area: string; time: string; x: string; y: string};

/** The sidebar section's unfold (--animate-collapsible-down, 0.2 s) plus a frame: scroll once it has its full height */
const SECTION_UNFOLD_MS = 220;

const formResolver = fieldsResolver<FormValues>({
    area: oneOf(areaOptions.map((option) => option.value), 'Kies een deelgebied.'),
    time: nonEmptyString('Kies een tijd.'),
    x: stringOfLength(6, 'Vul 6 cijfers in.'),
    y: stringOfLength(6, 'Vul 6 cijfers in.'),
});

export default function HintEntryCard({mapRef}: { mapRef: React.RefObject<MapRef | null> }) {
    const {coords, clear} = useHintFormBridge();
    const fieldId = useId();
    const isMobile = useIsMobile();
    const reducedMotion = useReducedMotion() ?? false;
    const formRef = useRef<HTMLFormElement>(null);
    const submitId = `${fieldId}-submit`;
    const {markers, loaded: markersLoaded, isError: markersError, retry: retryMarkers, createMarker, fetchFreshMarkers} = useMarkers();
    const [timeOpen, setTimeOpen] = useState(false);
    const {huntStart, huntEnd} = useAppConfig();
    // An archive edition is read-only: the boxes (and wildcard guesses) still work, Registreren doesn't
    const {readOnly} = useEdition();
    const HUNT_START = huntStart ? new Date(huntStart) : null;
    const HUNT_END = huntEnd ? new Date(huntEnd) : null;
    // Without a configured hunt window there are no hint hours to pick. Until the markers are in it isn't known which hours
    // are taken: null, so no hour counts as free (and Registreren waits) instead of every hour looking free.
    const hintHours = (area: string) => (HUNT_START && HUNT_END ? buildHintHours(HUNT_START, HUNT_END, new Date(), markersLoaded ? markers : undefined, area) : []);
    const markersFailed = !markersLoaded && !!markersError;

    const form = useForm<FormValues>({
        resolver: formResolver,
        // The draft from before (the phone page was left, or the page reloaded) comes back
        defaultValues: useHintDraftStore.getState().draft,
    });
    const selectedArea = useWatch({control: form.control, name: 'area'});
    const [timeValue, xValue, yValue] = useWatch({control: form.control, name: ['time', 'x', 'y']});
    // The last hint that got no answer and wasn't confirmed: a later poll (or Opnieuw controleren) can still find it.
    // Kept in the draft store, so leaving the phone page and coming back keeps Opnieuw controleren (no second send).
    // The ref settles it once (the poll and a recheck can both see it); the state drives the render.
    const pendingRef = useRef<UnconfirmedHint | null>(useHintDraftStore.getState().pending);
    const [pending, setPendingState] = useState<UnconfirmedHint | null>(pendingRef.current);
    const setPending = (next: UnconfirmedHint | null) => {
        pendingRef.current = next;
        setPendingState(next);
        useHintDraftStore.getState().setPending(next);
    };
    // What the last Registreren attempt ran into when no answer came (offline); the draft stays either way
    const [submitError, setSubmitError] = useState<string | null>(() => (pendingRef.current ? lostResponseMessage(pendingRef.current.outcome) : null));
    const [checking, setChecking] = useState(false);

    // Every change goes to the draft store, so leaving the page doesn't lose what was typed
    useEffect(() => {
        useHintDraftStore.getState().save({area: selectedArea, time: timeValue, x: xValue, y: yValue});
    }, [selectedArea, timeValue, xValue, yValue]);

    // A '?' in a box is an unknown digit: the candidates go on the map (lib/hint-guess.ts) and Registreren waits
    const wildcard = hasWildcard(xValue ?? '', yValue ?? '');
    const complete = xValue?.length === 6 && yValue?.length === 6;
    // Live check once both coordinates are complete: hints are always in the Netherlands
    const typedLocation = complete && !wildcard ? fromRD(Number(xValue), Number(yValue)) : undefined;
    const outsideNetherlands = !!typedLocation && !isInNetherlands(typedLocation[0], typedLocation[1]);
    // Hours for the chosen area; hours that already have a hint are kept but marked taken
    const hours = hintHours(selectedArea);
    const hoursKnown = hours !== null;
    const days = groupByDay(hours ?? []);

    // setValue without validation doesn't update formState.isValid in onSubmit mode, so derive from values.
    // The chosen hour is rechecked: a teammate can register it while this form is open.
    const canSubmit = !!selectedArea && !!timeValue && complete && !wildcard && !outsideNetherlands
        && isFreeHour(hours, timeValue);
    // Said in words: the taken tile's title tooltip and the red trigger edge alone aren't seen on a phone
    // Our own lost hint showing up in a poll takes its hour too: that is the late success (below), not someone else
    const ownHintArrived = holdsUnconfirmedHint(markersLoaded ? markers : undefined, pending);
    const hourTaken = isTakenHour(hours, timeValue) && !ownHintArrived;
    const coordinateState: CoordinateState = outsideNetherlands ? 'outside' : typedLocation ? 'inside' : 'idle';
    const guess = wildcard && complete ? parseGuess(xValue, yValue) : null;
    // The typed guess, when it should be on the map ('' otherwise)
    const guessKey = wildcard && complete ? `${xValue}|${yValue}|${selectedArea}|${timeValue}` : '';
    // The guess key that was taken off the map from elsewhere (Escape, an Intel guess replacing it) while still typed:
    // the line then says how to get it back instead of "tik er een op de kaart". Tapping a box shows it again.
    const [hiddenKey, setHiddenKey] = useState<string | null>(null);
    const latestKey = useRef('');
    const offMap = !!guessKey && hiddenKey === guessKey;
    const status: GuessStatus | null = !wildcard
        ? null
        : offMap
            ? {tone: 'guess', text: 'Tik op een vakje om de kandidaten weer te tonen'}
            : guessStatus(guess);

    // A complete coordinate in the Netherlands goes on the map as a preview pin (the store's input without a '?'), so it
    // can be checked against the map before Registreren
    const previewable = !!typedLocation && !outsideNetherlands;

    /** Put the typed guess (or the preview of a complete coordinate) on the map; an equal one already there stays */
    function showCardGuess() {
        if (!complete || (!wildcard && !previewable)) return;
        useHintGuessStore.getState().show({
            source: 'card', x: xValue, y: yValue, area: selectedArea || null,
            at: (timeValue ? Date.parse(timeValue) : NaN) || null, articleId: null, format: 'split',
        });
    }

    // Declared before the show effect: the store listener reads the key of this render
    useEffect(() => {
        latestKey.current = guessKey;
    });
    useEffect(() => useHintGuessStore.subscribe((state, prev) => {
        if (state.input?.source === 'card') setHiddenKey(null);
        // The card's own clear (boxes no longer complete) runs after latestKey went '' and doesn't count
        else if (prev.input?.source === 'card' && latestKey.current) setHiddenKey(latestKey.current);
    }), []);

    // Show (or take away) the candidates on the map as the boxes change; picking one fills the boxes via the bridge
    useEffect(() => {
        if (complete && (wildcard || previewable)) showCardGuess();
        else useHintGuessStore.getState().clear('card');
        // eslint-disable-next-line react-hooks/exhaustive-deps -- showCardGuess reads exactly these values
    }, [wildcard, complete, previewable, xValue, yValue, selectedArea, timeValue]);
    useEffect(() => () => useHintGuessStore.getState().clear('card'), []);

    // Handle hint bridge. The reveal timer outlives the clear() below (which re-runs this effect), so it sits in a ref.
    const revealTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(revealTimer.current), []);
    useEffect(() => {
        if (!coords) return;
        form.setValue("x", coords.x, { shouldValidate: true, shouldDirty: true });
        form.setValue("y", coords.y, { shouldValidate: true, shouldDirty: true });
        clear();
        if (!coords.reveal) return;
        // Laptop "In hint": once the section has unfolded, bring the form into view and start at Deelgebied
        window.clearTimeout(revealTimer.current);
        revealTimer.current = window.setTimeout(() => {
            formRef.current?.scrollIntoView({block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth'});
            document.getElementById(`${fieldId}-area`)?.focus({preventScroll: true});
        }, SECTION_UNFOLD_MS);
    }, [coords, clear, form, fieldId, reducedMotion]);

    /**
     * Choose an area; the chosen time stays only while it's still free for the new area.
     */
    function changeArea(area: string) {
        form.setValue('area', area, {shouldValidate: true, shouldDirty: true});
        const time = form.getValues('time');
        const areaHours = hintHours(area);
        // Unknown hours (markers still loading) keep the time; it's checked again once they're in
        if (time && areaHours && !isFreeHour(areaHours, time)) {
            form.setValue('time', '', {shouldDirty: true});
        }
    }

    /**
     * When submitted, create a new marker.
     * Checks if the coördinates are valid.
     */
    async function onSubmit(data: FormValues) {
        if (readOnly) return;
        // Convert RD coordinates to WGS84
        const x = Number(data.x);
        const y = Number(data.y);
        if (!isPlausibleRD(x, y)) {
            form.setError('x', {message: 'Ongeldige coördinaten'});
            form.setError('y', {message: 'Ongeldige coördinaten'});
            toast.error('Ongeldige coördinaten', {description: "Deze coördinaten zijn ongeldig. Controleer of de ingevoerde waarden correct zijn."});
            return;
        }
        const converted = fromRD(x, y);
        if (!isInNetherlands(converted[0], converted[1])) {
            form.setError('y', {message: 'Dit coördinaat ligt buiten Nederland'});
            toast.error('Coördinaat buiten Nederland', {description: 'Controleer de X- en Y-waarden; een hint ligt altijd in Nederland.'});
            return;
        }

        const marker: Marker = {
            area: data.area,
            time: new Date(data.time),
            location: {
                type: 'Point',
                coordinates: [converted[0], converted[1]],
            },
            type: MarkerType.Hint,
        };

        setSubmitError(null);
        setPending(null);
        const error = await createMarker(marker);
        if (error && isNetworkError(error)) {
            // No answer (offline, timeout) doesn't mean it failed: the server may have saved it. A fresh list tells.
            const outcome = lostResponseOutcome(await fetchFreshMarkers(), marker);
            if (outcome !== 'registered') {
                // The typed hint stays in the form (and the draft); a later poll that finds it still confirms it
                setPending({sent: marker, values: data, outcome});
                setSubmitError(lostResponseMessage(outcome));
                return;
            }
            registered(data, converted, {late: true, focus: true});
            return;
        } else if (error) {
            toast.error('Hint registreren is mislukt', {
                description: apiErrorMessage(error, 'Probeer het opnieuw.')
            });
            return;
        }
        registered(data, converted, {late: false, focus: true});
    }

    /**
     * A hint is on the server: reset the form (unless a next hint was typed meanwhile), say so and show it.
     * @param late Confirmed after a lost answer (a fresh list, a recheck or a later poll)
     * @param focus Fly to it and put the focus at the area for the next hint (not when a background poll confirmed it)
     */
    function registered(data: FormValues, [lng, lat]: number[], {late, focus}: { late: boolean; focus: boolean }) {
        setSubmitError(null);
        setPending(null);
        const flyToHint = () => {
            // On a phone the full sheet would hide the flight: lower it to peek first (like Hunts and Voorspellingen)
            if (isMobile) useSidebarStore.getState().setSheetSnap('peek');
            mapRef.current?.flyTo({
                center: [lng, lat],
                duration: 2000,
                zoom: 12,
            });
        };
        const lateNote = late ? 'Bevestigd na verbindingsherstel.' : undefined;
        // A next hint (or a correction) was typed while Registreren ran: leave it, the sheet and the focus alone
        if (!sameDraft(form.getValues(), data)) {
            toast.success('Vorige hint geregistreerd — je nieuwe invoer is nog niet verzonden', {
                description: lateNote,
                // Longer than the default 4 s: time to read it and reach Toon
                duration: 15000,
                action: {label: 'Toon', onClick: flyToHint},
            });
            return;
        }
        form.reset(EMPTY_HINT_DRAFT);
        useHintDraftStore.getState().clear();
        const title = late ? 'Hint geregistreerd (bevestigd na verbindingsherstel)' : 'Hint geregistreerd';
        if (!focus) {
            // A poll confirmed it in the background: no map flight or focus jump, Toon is there to look
            toast.success(title, {duration: 15000, action: {label: 'Toon', onClick: flyToHint}});
            return;
        }
        toast.success(title);
        flyToHint();
        // The button stays focused while it registers; afterwards the next hint starts at the area
        document.getElementById(`${fieldId}-area`)?.focus();
    }

    /** Settle the lost hint as registered, once (a poll and a recheck can both find it). */
    function confirmPending(focus: boolean) {
        const lost = pendingRef.current;
        if (!lost) return;
        registered(lost.values, lost.sent.location.coordinates, {late: true, focus});
    }

    // A later poll brings our own lost hint: the late success, not "net door iemand anders geregistreerd"
    useEffect(() => {
        if (ownHintArrived) confirmPending(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the poll first holds it; confirmPending reads the ref
    }, [ownHintArrived]);

    /** Opnieuw controleren: look for the lost hint in a fresh list instead of registering it a second time. */
    async function recheck() {
        const lost = pendingRef.current;
        if (!lost || checking) return;
        setChecking(true);
        const outcome = lostResponseOutcome(await fetchFreshMarkers(), lost.sent);
        setChecking(false);
        if (outcome === 'registered') {
            confirmPending(true);
            return;
        }
        // The poll may have settled it meanwhile
        if (pendingRef.current !== lost) return;
        setPending({...lost, outcome});
        setSubmitError(lostResponseMessage(outcome));
        // Same answer as before: the line doesn't change, so say it once more
        if (outcome === 'unknown') toast.error('Nog steeds geen antwoord', {description: 'Controleer je verbinding en probeer het zo nog eens.'});
    }

    const submitting = form.formState.isSubmitting;
    // No answer and no fresh list: registering again could place it twice, so checking leads (like the Hunt/Spot dialog)
    const primary = hintPrimaryAction(pending, {area: selectedArea, time: timeValue, x: xValue, y: yValue});
    const busy = submitting || checking;

    /** Wissen: empty both coordinates. */
    function clearCoordinates() {
        form.setValue('x', '');
        form.setValue('y', '');
        form.clearErrors(['x', 'y']);
        useHintGuessStore.getState().clear('card');
        document.getElementById(`${fieldId}-x`)?.focus();
    }

    /** Both coordinates pasted into one row: fill X and Y, then on to Registreren (like typing the last digit of Y) */
    function pastePair(x: string, y: string) {
        form.setValue('x', x, {shouldValidate: true, shouldDirty: true});
        form.setValue('y', y, {shouldValidate: true, shouldDirty: true});
        setTimeout(() => document.getElementById(submitId)?.focus());
    }

    /**
     * One RD coordinate row: axis label and 6 digit boxes.
     * Calls onComplete once all 6 digits are entered, so focus can move on.
     */
    const coordinateField = (name: 'x' | 'y', label: string, onComplete: () => void) => (
        <Controller
            control={form.control}
            name={name}
            render={({field, fieldState}) => (
                <DigitBoxes id={`${fieldId}-${name}`} label={label} onComplete={onComplete} onPastePair={pastePair}
                            bad={outsideNetherlands || fieldState.invalid} {...field}/>
            )}
        />
    );

    return (
        <form ref={formRef} onSubmit={(e) => {
            // Registreren is aria-disabled (not disabled) while busy, so Enter can still submit: ignore it
            if (busy) return e.preventDefault();
            if (primary === 'recheck') {
                e.preventDefault();
                void recheck();
                return;
            }
            void form.handleSubmit(onSubmit)(e);
        }} className="flex flex-col gap-3">
            {/* isolate: the pickers' 44px touch areas (COARSE_HIT_AREA) stay above the block's background */}
            <div className="isolate flex flex-col gap-1 rounded-[16px] bg-beheer-row p-2.5">
                <div className="mb-1 flex gap-1">
                    <Controller
                        control={form.control}
                        name="area"
                        render={({field, fieldState}) => (
                            <div className="min-w-0 flex-1">
                                <AreaPicker id={`${fieldId}-area`} value={field.value} onChange={changeArea}
                                            invalid={fieldState.invalid} afterPick={() => setTimeOpen(true)}/>
                            </div>
                        )}
                    />
                    <Controller
                        control={form.control}
                        name="time"
                        render={({field, fieldState}) => (
                            <div className="min-w-0 flex-1">
                                <TimePicker id={`${fieldId}-time`} value={field.value} onChange={field.onChange}
                                            days={days} open={timeOpen} onOpenChange={setTimeOpen}
                                            disabled={!selectedArea || !hoursKnown}
                                            loading={!hoursKnown && !markersFailed}
                                            invalid={fieldState.invalid || (hoursKnown && !!field.value && !isFreeHour(hours, field.value))}
                                            afterPick={() => document.getElementById(`${fieldId}-x`)?.focus()}/>
                            </div>
                        )}
                    />
                </div>
                <Reveal gap={4}>
                    {hourTaken && (
                        <InlineError role="alert">
                            {formatClock(timeValue)} is net door iemand anders geregistreerd. Kies een ander uur.
                        </InlineError>
                    )}
                </Reveal>
                {/* Tapping a box brings a guess that was taken off the map back */}
                <div className="contents" onFocus={showCardGuess} onPointerDown={showCardGuess}>
                    {coordinateField('x', 'X', () => document.getElementById(`${fieldId}-y`)?.focus())}
                    {coordinateField('y', 'Y', () => setTimeout(() => document.getElementById(submitId)?.focus()))}
                </div>
                {/* The first marker load failed: which hours are free is unknown, so time and Registreren wait for a retry */}
                <Reveal gap={4}>
                    {markersFailed && (
                        <LoadError blocking message="Hints konden niet worden geladen, dus de vrije tijden zijn onbekend." onRetry={retryMarkers} className="py-1"/>
                    )}
                </Reveal>
                <div className="isolate mt-0.5 flex items-center justify-between gap-2">
                    <CoordinateStatus state={coordinateState} guess={status} missing={missingPickText(selectedArea, timeValue)}
                                      inside={typedLocation && !outsideNetherlands ? previousHintText(markersLoaded ? markers : undefined, selectedArea, timeValue, [typedLocation[0], typedLocation[1]]) : null}/>
                    <button type="button" onClick={clearCoordinates}
                            className={`${COARSE_HIT_AREA} inline-flex items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-primary-text desk:text-[11px] outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring`}>
                        <EraserIcon aria-hidden className="size-3"/> Wissen
                    </button>
                </div>
            </div>
            {/* One button whose action follows the state, so its label swaps instead of a new button popping in */}
            <Button id={submitId} type="submit" className={`${SOFT_PRIMARY_BUTTON} h-11 text-[15px]`}
                    disabled={primary === 'register' && (!canSubmit || readOnly)}
                    aria-disabled={busy || undefined} aria-busy={busy || undefined}>
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={`${primary}-${busy ? 'busy' : 'idle'}`} className="inline-flex items-center gap-2" {...SWAP}>
                        {busy ? <Loader2Icon className="animate-spin"/> : primary === 'recheck' ? <RefreshCwIcon/> : <Pin/>}
                        {primary === 'recheck'
                            ? (checking ? 'Controleren…' : 'Opnieuw controleren')
                            : (submitting ? 'Registreren…' : 'Registreren')}
                    </motion.span>
                </AnimatePresence>
            </Button>
            {/* Why Registreren is greyed out in an archive edition */}
            <ArchiveReadOnlyNote gap={12}/>
            <Reveal gap={12}>
                {submitError && <InlineError role="alert">{submitError}</InlineError>}
            </Reveal>
        </form>
    );
}
