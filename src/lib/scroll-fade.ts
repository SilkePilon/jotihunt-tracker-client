/** Slack (px) for sub-pixel scroll positions: closer to the end than this counts as at the end. */
const END_SLACK = 1;

/** True while a scroller has content below its visible part (not scrolled to the end); false when it all fits. */
export function hasMoreBelow({ scrollTop, scrollHeight, clientHeight }: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>): boolean {
  return scrollHeight - clientHeight - scrollTop > END_SLACK;
}
