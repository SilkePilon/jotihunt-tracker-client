import {z} from 'zod';
import {Controller, useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button} from '../../ui/button.tsx';
import {EraserIcon, Pin} from 'lucide-react';
import {useMarkers} from '@/hooks/markers.hook.ts';
import {toast} from 'sonner';
import {MapRef} from '@/components/Map.tsx';
import {MarkerType} from '@/types/MarkerType.ts';
import {Marker} from '@/types/Marker.ts';
import {areaOptions} from '@/lib/utils.ts';
import {useEffect, useId, useState} from "react";
import {useHintFormBridge} from "@/hooks/hint-bridge.hook.ts";
import {useAppConfig} from '@/hooks/app-config.hook';
import {isInNetherlands} from '@/lib/netherlands';
import {fromRD, isPlausibleRD} from '@/lib/rd';
import {apiErrorMessage} from '@/lib/api-error';
import AreaPicker from './AreaPicker';
import TimePicker from './TimePicker';
import DigitBoxes from './DigitBoxes';
import CoordinateStatus, {type CoordinateState} from './CoordinateStatus';
import {buildHintHours, groupByDay, isFreeHour} from './hint-times';
import {SOFT_PRIMARY_BUTTON} from '@/lib/tonal-button';

const FormSchema = z.object({
    area: z.enum([...areaOptions.map((option) => option.value)] as [string, ...string[]]),
    time: z.string().min(1),
    x: z.string().length(6),
    y: z.string().length(6),
});

export default function HintEntryCard({mapRef}: { mapRef: React.RefObject<MapRef | null> }) {
    const {coords, clear} = useHintFormBridge();
    const fieldId = useId();
    const submitId = `${fieldId}-submit`;
    const {markers, createMarker} = useMarkers();
    const [timeOpen, setTimeOpen] = useState(false);
    const {huntStart, huntEnd} = useAppConfig();
    const HUNT_START = huntStart ? new Date(huntStart) : null;
    const HUNT_END = huntEnd ? new Date(huntEnd) : null;
    // Without a configured hunt window there are no hint hours to pick
    const hintHours = (area: string) => (HUNT_START && HUNT_END ? buildHintHours(HUNT_START, HUNT_END, new Date(), markers, area) : []);

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            area: '',
            time: '',
            x: '',
            y: '',
        },
    });
    const selectedArea = useWatch({control: form.control, name: 'area'});
    const [timeValue, xValue, yValue] = useWatch({control: form.control, name: ['time', 'x', 'y']});

    // Live check once both coordinates are complete: hints are always in the Netherlands
    const typedLocation = xValue?.length === 6 && yValue?.length === 6 ? fromRD(Number(xValue), Number(yValue)) : undefined;
    const outsideNetherlands = !!typedLocation && !isInNetherlands(typedLocation[0], typedLocation[1]);
    // Hours for the chosen area; hours that already have a hint are kept but marked taken
    const hours = hintHours(selectedArea);
    const days = groupByDay(hours);

    // setValue without validation doesn't update formState.isValid in onSubmit mode, so derive from values.
    // The chosen hour is rechecked: a teammate can register it while this form is open.
    const canSubmit = !!selectedArea && !!timeValue && xValue?.length === 6 && yValue?.length === 6 && !outsideNetherlands
        && isFreeHour(hours, timeValue);
    const coordinateState: CoordinateState = outsideNetherlands ? 'outside' : typedLocation ? 'inside' : 'idle';

    // Handle hint bridge
    useEffect(() => {
        if (coords) {
            form.setValue("x", coords.x, { shouldValidate: true, shouldDirty: true });
            form.setValue("y", coords.y, { shouldValidate: true, shouldDirty: true });
            clear();
        }
    }, [coords, clear, form]);

    /**
     * Choose an area; the chosen time stays only while it's still free for the new area.
     */
    function changeArea(area: string) {
        form.setValue('area', area, {shouldValidate: true, shouldDirty: true});
        const time = form.getValues('time');
        if (time && !isFreeHour(hintHours(area), time)) {
            form.setValue('time', '', {shouldDirty: true});
        }
    }

    /**
     * When submitted, create a new marker.
     * Checks if the coördinates are valid.
     */
    async function onSubmit(data: z.infer<typeof FormSchema>) {
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

        const error = await createMarker(marker);
        if (!error) {
            form.reset();
            toast.success('Hint geregistreerd!', {
                description: 'De hint is succesvol geregistreerd.'
            });
            mapRef.current?.flyTo({
                center: [converted[0], converted[1]],
                duration: 2000,
                zoom: 12,
            });
        } else {
            toast.error('Fout bij registreren hint.', {
                description: apiErrorMessage(error, 'Er is een fout opgetreden bij het registreren van de hint.')
            });
        }
    }

    /** Wissen: empty both coordinates. */
    function clearCoordinates() {
        form.setValue('x', '');
        form.setValue('y', '');
        form.clearErrors(['x', 'y']);
        document.getElementById(`${fieldId}-x`)?.focus();
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
                <DigitBoxes id={`${fieldId}-${name}`} label={label} onComplete={onComplete}
                            bad={outsideNetherlands || fieldState.invalid} {...field}/>
            )}
        />
    );

    return (
        <form onSubmit={(e) => form.handleSubmit(onSubmit)(e)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 rounded-[16px] bg-beheer-row p-2.5">
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
                                            disabled={!selectedArea}
                                            invalid={fieldState.invalid || (!!field.value && !isFreeHour(hours, field.value))}
                                            afterPick={() => document.getElementById(`${fieldId}-x`)?.focus()}/>
                            </div>
                        )}
                    />
                </div>
                {coordinateField('x', 'X', () => document.getElementById(`${fieldId}-y`)?.focus())}
                {coordinateField('y', 'Y', () => setTimeout(() => document.getElementById(submitId)?.focus()))}
                <div className="mt-0.5 flex items-center justify-between gap-2">
                    <CoordinateStatus state={coordinateState}/>
                    <button type="button" onClick={clearCoordinates}
                            className="inline-flex items-center gap-1.5 rounded-lg px-1 text-[11px] font-semibold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                        <EraserIcon aria-hidden className="size-3"/> Wissen
                    </button>
                </div>
            </div>
            <Button id={submitId} type="submit" className={`${SOFT_PRIMARY_BUTTON} h-11 text-[15px]`} disabled={!canSubmit || form.formState.isSubmitting}>
                <Pin data-icon="inline-start"/> Registreren
            </Button>
        </form>
    );
}
