import { GlassesIcon, LocateFixedIcon, PinIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { MarkerType } from '@/types/MarkerType';
import { useId, useState } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { areaOptions, capitalizeFirstLetter } from '@/lib/utils';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field, FieldError, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { Marker } from '@/types/Marker';
import { useMarkers } from '@/hooks/markers.hook';
import { useAppConfig } from '@/hooks/app-config.hook';
import {toast} from "sonner";
import { apiErrorMessage } from '@/lib/api-error';
import { popupActionClass } from './popup/PopupActions';


const FormSchema = z.object({
  area: z.enum([...areaOptions.map((option) => option.value)] as [string, ...string[]], { message: 'Geen geldig deelgebied.' }),
  day: z.date(),
  time: z.date(),
});

/** Hunt / Spot buttons (fragment children, for inside `PopupActions`) plus the dialog to register a marker at this point. */
export default function MarkerRegistration({ lat, lng }: { lat: number; lng: number }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [markerType, setMarkerType] = useState<MarkerType>();
  const { createMarker } = useMarkers();
  const fieldId = useId();
  // Before the hunt window is configured the pickers offer today and any time is accepted
  const { huntStart, huntEnd } = useAppConfig();
  const HUNT_START_TIME = huntStart ? new Date(huntStart) : new Date();
  const HUNT_END_TIME = huntEnd ? new Date(huntEnd) : new Date();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      area: '',
      day: getCurrentOrFirstDate(),
      time: getCurrentOrFirstDate(),
    },
  });

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
    setMarkerType(markerType);
    setDialogOpen(true);
  }

  /**
   * Properly handle resetting the form on dialog open change.
   * @param open Whether the dialog is open.
   */
  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    form.reset();
  }

  /**
   * Submit the form data to create a marker.
   * @param data The form data.
   * @returns Absolutely nothing :)
   */
  async function onSubmit(data: z.infer<typeof FormSchema>) {
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
    if (!error) {
      handleOpenChange(false);
      toast.success('Marker geplaatst!', { description: 'De marker is succesvol geplaatst.' });
    } else {
      // The server's message for e.g. a 429 (too many markers in a row)
      toast.error('Er is iets misgegaan.', { description: apiErrorMessage(error, 'Er is een fout opgetreden bij het plaatsen van de marker, probeer het later opnieuw.') });
    }
  }

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
                  <SelectTrigger id={`${fieldId}-area`} className="w-full" aria-invalid={fieldState.invalid}>
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
        <div className="flex gap-4 w-full">
          {/* Select with all days */}
          <Controller
            control={form.control}
            name="day"
            render={({ field, fieldState }) => {
              const dateValue = field.value instanceof Date ? field.value : new Date(field.value); // Ensure it's a Date
              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${fieldId}-day`}>Dag</FieldLabel>
                  <Select name={field.name} onValueChange={(value) => field.onChange(new Date(value))} value={dateValue.toDateString()}>
                    <SelectTrigger id={`${fieldId}-day`} className="w-full" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Kies dag..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {getDays().map((day) => (
                          <SelectItem key={day.toDateString()} value={day.toDateString()}>
                            {day.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
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
                <Field data-invalid={fieldState.invalid}>
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
                    className="border p-2 rounded w-full"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              );
            }}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>
            Annuleren
          </Button>
          <Button variant="default" type="submit" disabled={!form.formState.isValid}>
            <PinIcon data-icon="inline-start" />
            Opslaan
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  );

  const dialog = () => (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
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
      <button type="button" className={popupActionClass('primary', 'min-w-0 flex-1')} onClick={() => openDialog(MarkerType.Hunt)}>
        <LocateFixedIcon /> Hunt
      </button>
      <button type="button" className={popupActionClass('primary', 'min-w-0 flex-1')} onClick={() => openDialog(MarkerType.Spot)}>
        <GlassesIcon /> Spot
      </button>
    </>
  );
}
