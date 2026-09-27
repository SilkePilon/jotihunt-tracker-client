import type { IControl, Map } from 'maplibre-gl';

/**
 * The @mapbox-controls packages render their container with mapboxgl-* classes only.
 * Add MapLibre's equivalents so the controls get the standard control-group styling.
 * @param control The control instance
 * @returns The same control, with a patched onAdd
 */
export function withMaplibreClasses<T extends IControl>(control: T): T {
  const onAdd = control.onAdd.bind(control);
  control.onAdd = (map: Map) => {
    const container = onAdd(map);
    container.classList.add('maplibregl-ctrl', 'maplibregl-ctrl-group');
    return container;
  };
  return control;
}
