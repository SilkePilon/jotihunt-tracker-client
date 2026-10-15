import type { SidebarSectionId } from '@/stores/sidebar.store';

/** Pages of the phone sheet. Plan 1: one per sidebar section. */
export type MobilePageId = SidebarSectionId;
export interface MobilePage {
  id: MobilePageId;
  params?: Record<string, string>;
}

function samePage(a: MobilePage, b: MobilePage): boolean {
  return a.id === b.id && JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});
}

export function pushPage(stack: MobilePage[], page: MobilePage): MobilePage[] {
  const top = stack[stack.length - 1];
  return top && samePage(top, page) ? stack : [...stack, page];
}

export function popPage(stack: MobilePage[]): MobilePage[] {
  return stack.slice(0, -1);
}

export function replacePage(stack: MobilePage[], page: MobilePage): MobilePage[] {
  return [...stack.slice(0, -1), page];
}
