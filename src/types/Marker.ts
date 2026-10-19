import { MarkerType } from './MarkerType';

export interface Marker {
  _id?: string;
  area: string;
  time: Date;
  location: {
    type: string;
    coordinates: number[];
  };
  type: MarkerType;
  /** Manual override of the routed leg arriving at this marker (absent: automatic) */
  legMode?: 'walk' | 'car';
  /** "jotiboard": imported by the Jotiboard sync; "jotihunt": made from a hunt synced from jotihunt.nl (absent: ours) */
  source?: 'jotiboard' | 'jotihunt';
  /** Jotiboard pin id, or the synced hunt's siteKey for a "jotihunt" marker */
  externalId?: string;
}
