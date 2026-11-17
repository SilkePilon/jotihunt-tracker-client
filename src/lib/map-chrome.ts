/** Floating map surfaces (map option C): card tile with a thin ring and a soft drop shadow. */
export const MAP_TILE = 'bg-card text-card-foreground shadow-(--shadow-tile)';

/** The 32px tonal box that leads a map tile, holding its icon. */
export const MAP_CHIP = 'grid size-8 shrink-0 place-items-center rounded-md bg-beheer-row-high [&_svg]:size-4';

/** The pulse ring at a located spot ("Mijn locatie"): the browser's blue location-dot colour. A hex, since map layers draw it */
export const MAP_LOCATION_COLOR = '#3b82f6';
