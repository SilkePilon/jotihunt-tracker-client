import { MapIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { googleMapsUrl } from '@/lib/hunters';

export default function GoogleMapsButton({ lat, lng, label = 'Bekijk op Google Maps' }: { lat: number; lng: number; label?: string }) {
  return (
    <Button variant="outline" size="sm" asChild className="w-full">
      <a target="_blank" rel="noreferrer" href={googleMapsUrl(lat, lng)}>
        <MapIcon /> {label}
      </a>
    </Button>
  );
}
