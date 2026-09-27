import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select.tsx';
import {Field, FieldGroup, FieldLabel} from '@/components/ui/field.tsx';
import {z} from 'zod';
import {Controller, useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button} from '../../ui/button.tsx';
import {InputOTP, InputOTPGroup, InputOTPSlot} from '../../ui/input-otp.tsx';
import {REGEXP_ONLY_DIGITS} from 'input-otp';
import {Pin, TrashIcon} from 'lucide-react';
import {useMarkers} from '@/hooks/markers.hook.ts';
import {toast} from 'sonner';
import PropTypes, {InferProps} from 'prop-types';
import {MapRef} from '@/components/Map.tsx';
import proj4 from 'proj4';
import {MarkerType} from '@/types/MarkerType.ts';
import {Marker} from '@/types/Marker.ts';
import {areaOptions} from '@/lib/utils.ts';
import {useEffect, useId} from "react";
import {useHintFormBridge} from "@/hooks/hint-bridge.hook.ts";
import {isInNetherlands} from '@/lib/netherlands';

const FormSchema = z.object({
    area: z.enum([...areaOptions.map((option) => option.value)] as [string, ...string[]]),
    time: z.string(),
    x: z.string().length(6),
    y: z.string().length(6),
});

export default function HintEntryCard({mapRef}: InferProps<typeof HintEntryCard.propTypes>) {
    const {coords, clear} = useHintFormBridge();
    const fieldId = useId();
    const submitId = `${fieldId}-submit`;
    const {markers, createMarker} = useMarkers();

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
    const [xValue, yValue] = useWatch({control: form.control, name: ['x', 'y']});

    // Live check once both coordinates are complete: hints are always in the Netherlands
    const typedLocation = xValue?.length === 6 && yValue?.length === 6 ? proj4('RD', 'WGS84', [Number(xValue), Number(yValue)]) : undefined;
    const outsideNetherlands = !!typedLocation && !isInNetherlands(typedLocation[0], typedLocation[1]);

    // Handle hint bridge
    useEffect(() => {
        if (coords) {
            form.setValue("x", coords.x, { shouldValidate: true, shouldDirty: true });
            form.setValue("y", coords.y, { shouldValidate: true, shouldDirty: true });
            clear();
        }
    }, [coords, clear, form]);

    /**
     * Get all available time options for the current area.
     * Filters out hints that are already in the database.
     * @returns The available time options
     */
    function getTimeOptions(): { value: string; label: string }[] {
        const startTime = new Date(import.meta.env.HUNT_START_TIME);
        const endTime = new Date(import.meta.env.HUNT_END_TIME);
        const currentTime = new Date();
        const adjustedEndTime = currentTime > endTime ? endTime : currentTime;

        const timeOptions: { value: string; label: string }[] = [];
        for (let i = startTime; i < adjustedEndTime; i.setHours(i.getHours() + 1)) {
            const formatted = i.toLocaleString('nl-NL', {weekday: 'long', hour: 'numeric'}) + ':00';
            timeOptions.push({value: i.toISOString(), label: formatted});
        }

        markers
            ?.filter((marker) => marker.area === selectedArea)
            .filter((marker) => marker.type === MarkerType.Hint)
            .forEach((marker) => {
                const markerTime = new Date(marker.time);
                const index = timeOptions.findIndex((option) => {
                    const optionTime = new Date(option.value);
                    return markerTime.getHours() === optionTime.getHours() && markerTime.getDate() === optionTime.getDate();
                });
                if (index !== -1) timeOptions.splice(index, 1);
            });

        return timeOptions;
    }

    const timeOptions = getTimeOptions();

    /**
     * When submitted, create a new marker.
     * Checks if the coördinates are valid.
     */
    async function onSubmit(data: z.infer<typeof FormSchema>) {
        // Convert RD coordinates to WGS84
        const x = Number(data.x);
        const y = Number(data.y);
        const converted = proj4('RD', 'WGS84', [x, y]);
        if (converted[0] === undefined || converted[1] === undefined || x < 0 || x > 290000 || y < 290000 || y > 630000) {
            form.setError('x', {message: 'Ongeldige coördinaten'});
            form.setError('y', {message: 'Ongeldige coördinaten'});
            toast.error('Ongeldige coördinaten', {description: "Deze coördinaten zijn ongeldig. Controleer of de ingevoerde waarden correct zijn."});
            return;
        }
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
                coordinates: [converted[0]!, converted[1]!],
            },
            type: MarkerType.Hint,
        };

        const result = await createMarker(marker);
        if (result) {
            form.reset();
            toast.success('Hint geregistreerd!', {
                description: 'De hint is succesvol geregistreerd.'
            });
            mapRef.current?.flyTo({
                center: [converted[0]!, converted[1]!],
                duration: 2000,
                zoom: 12,
            });
        } else {
            toast.error('Fout bij registreren hint.', {
                description: 'Er is een fout opgetreden bij het registreren van de hint.'
            });
        }
    }

    /**
     * Clear a field in the form.
     * @param key The key of the field to clear
     */
    function clearField(key: keyof z.infer<typeof FormSchema>) {
        form.setValue(key, '');
    }

    /**
     * One RD coordinate row: label, 6 digit slots and a clear button.
     * Calls onComplete once all 6 digits are entered, so focus can move on.
     */
    const coordinateField = (name: 'x' | 'y', label: string, onComplete: () => void) => (
        <Controller
            control={form.control}
            name={name}
            render={({field, fieldState}) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid} className="gap-2">
                    <FieldLabel htmlFor={`${fieldId}-${name}`} className="w-4 flex-none! font-semibold">{label}</FieldLabel>
                    <InputOTP id={`${fieldId}-${name}`} autoComplete="off" inputMode="numeric" maxLength={6}
                              pattern={REGEXP_ONLY_DIGITS} onComplete={onComplete} aria-invalid={fieldState.invalid}
                              {...field}>
                        <InputOTPGroup>
                            {[0, 1, 2, 3, 4, 5].map((index) => (
                                <InputOTPSlot key={index} index={index} className="h-9 w-9"
                                              aria-invalid={fieldState.invalid}/>
                            ))}
                        </InputOTPGroup>
                    </InputOTP>
                    <Button
                        variant="ghost"
                        size="icon"
                        tabIndex={-1}
                        aria-label={`${label}-coördinaat wissen`}
                        onClick={(e) => {
                            e.preventDefault();
                            clearField(name);
                        }}
                    >
                        <TrashIcon/>
                    </Button>
                </Field>
            )}
        />
    );

    return (
        <form onSubmit={(e) => form.handleSubmit(onSubmit)(e)}>
            <FieldGroup className="gap-3">
                <div className="flex gap-2 w-full">
                    <Controller
                        control={form.control}
                        name="area"
                        render={({field, fieldState}) => (
                            <Field data-invalid={fieldState.invalid} className="gap-2">
                                <FieldLabel htmlFor={`${fieldId}-area`}>Deelgebied</FieldLabel>
                                <Select name={field.name} onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger id={`${fieldId}-area`} aria-invalid={fieldState.invalid}>
                                        <SelectValue placeholder="Kies deelgebied..."/>
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
                            </Field>
                        )}
                    />
                    <Controller
                        control={form.control}
                        name="time"
                        render={({field, fieldState}) => (
                            <Field data-invalid={fieldState.invalid} className="gap-2">
                                <FieldLabel htmlFor={`${fieldId}-time`}>Tijdstip</FieldLabel>
                                <Select name={field.name} onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger id={`${fieldId}-time`} aria-invalid={fieldState.invalid}
                                                   disabled={!selectedArea}>
                                        <SelectValue placeholder="Kies tijdstip..."/>
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[280px]">
                                        <SelectGroup>
                                            {timeOptions.length > 0 ? (
                                                timeOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <SelectItem value="disabled" disabled>
                                                    (Nog) geen tijdstip te kiezen
                                                </SelectItem>
                                            )}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    {coordinateField('x', 'X', () => document.getElementById(`${fieldId}-y`)?.focus())}
                    {coordinateField('y', 'Y', () => setTimeout(() => document.getElementById(submitId)?.focus()))}
                    {outsideNetherlands && (
                        <p role="alert" className="text-sm font-medium text-destructive">
                            Dit coördinaat ligt buiten Nederland. Controleer de X- en Y-waarden.
                        </p>
                    )}
                </div>
                <Button id={submitId} type="submit" disabled={!form.formState.isValid || outsideNetherlands}>
                    <Pin data-icon="inline-start"/> Registreren
                </Button>
            </FieldGroup>
        </form>
    );
}

HintEntryCard.propTypes = {
    mapRef: PropTypes.object.isRequired as PropTypes.Validator<React.RefObject<MapRef | null>>,
};
