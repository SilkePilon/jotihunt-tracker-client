import { createCn } from 'cn/config';

/**
 * Class-name merging (clsx + tailwind-merge compatible), the helper every component uses. Knows the named type scale
 * from index.css (@theme --text-label/caption/body): without it the merger reads `text-label` as a colour and drops it
 * next to `text-muted-foreground`.
 */
export const cn = createCn({
  extend: { classGroups: { 'font-size': [{ text: ['label', 'caption', 'body'] }] } },
});
