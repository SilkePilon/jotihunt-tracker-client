/**
 * Coarse pointers (phones): grows a small control's hit area to at least 44×44 px with an invisible ::after, without
 * changing how it looks. The ::after sits at z-index −1, i.e. in the parent's stacking context below every sibling
 * control, so a tap on a neighbour's own body still goes to that neighbour; only taps in the gaps around it are caught.
 * Give the controls' common parent `isolate`, so the ::after layer stays above the parent's own background. A control
 * with a transform at rest would trap its ::after (motion leaves `transform: none` once an animation ends, which is fine).
 */
export const COARSE_HIT_AREA =
  "relative pointer-coarse:after:absolute pointer-coarse:after:-z-10 pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']";
