export type Brand = 'mcdonalds' | 'kfc' | 'burgerking';

/** One restaurant from GET /fastfood (OpenStreetMap); `intervals` is absent when the opening hours are unknown. */
export interface FastfoodRestaurant {
  /** "node/123" */
  osmId: string;
  brand: Brand;
  /** e.g. "Arnhem Rijnstraat" */
  branch?: string;
  location: { type: 'Point'; coordinates: [number, number] };
  street?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  phone?: string;
  website?: string;
  driveThrough?: boolean;
  openingHours?: string;
  updatedAt: string;
  /** Open times in the next 8 days (ISO); the first may start at "now" */
  intervals?: { start: string; end: string }[];
}
