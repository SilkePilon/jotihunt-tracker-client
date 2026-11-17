/** Structural stand-ins for DOM nodes, so the rules below run (and are tested) without a DOM. */
export interface ConnectedNode {
  isConnected: boolean;
}
export interface ContainerNode {
  contains(other: unknown): boolean;
}

/**
 * Where focus goes once a popup/card that may have held it is gone: back to the opener (else the fallback, e.g. the
 * map canvas). Only when focus was lost with it (it sits on <body> or a detached node then); null leaves focus alone,
 * e.g. after a tap elsewhere already moved it.
 */
export function focusRestoreTarget<T extends ConnectedNode>(active: ConnectedNode | null, body: ConnectedNode, opener: T | null, fallback: T | null | undefined): T | null {
  if (active && active !== body && active.isConnected) return null;
  return opener?.isConnected ? opener : (fallback ?? null);
}

/**
 * Whether a key press belongs to a surface (a map popup, the tour card) rather than to whatever else has focus: it
 * was not handled yet and focus is on <body> or inside one of `within` (the surface itself, the map).
 */
export function ownsKey(event: { defaultPrevented: boolean; target: unknown }, body: unknown, within: (ContainerNode | null | undefined)[]): boolean {
  if (event.defaultPrevented) return false;
  if (event.target === body) return true;
  return within.some((container) => container?.contains(event.target) ?? false);
}

export interface FocusedNode extends ConnectedNode {
  closest(selector: string): unknown;
}

/**
 * Whether focus was dropped by a view change: it sits on nothing or <body>, on a removed node, or inside an inert
 * subtree (a pushed view that is leaving, a collapsed button). Then the arriving view may take it; otherwise focus
 * moved somewhere on purpose and stays.
 */
export function focusDropped(active: FocusedNode | null, body: unknown): boolean {
  if (!active || active === body || !active.isConnected) return true;
  return active.closest('[inert]') !== null;
}
