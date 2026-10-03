import { useState } from 'react';

/**
 * Hover state for a map marker's tooltip, local to the marker so hovering re-renders only that marker.
 * While `disabled` (a popup of the layer is open) the tooltip stays closed and hovering is ignored; disabling also
 * forgets the hover, because Radix doesn't report the pointer leaving a tooltip it considers closed.
 */
export function useHoverTooltip(disabled: boolean) {
  const [hovered, setHovered] = useState(false);
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (wasDisabled !== disabled) {
    setWasDisabled(disabled);
    if (disabled) setHovered(false);
  }

  const onOpenChange = (open: boolean) => setHovered(open && !disabled);
  return { open: hovered, onOpenChange };
}
