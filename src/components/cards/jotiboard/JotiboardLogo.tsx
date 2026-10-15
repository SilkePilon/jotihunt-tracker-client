/** Own board icon (Jotiboard has no logo): rounded board, header line, divider, a pin dot. White stroke on the slate button. */
export default function JotiboardLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden className={className}>
      <rect x="2.5" y="3" width="15" height="14" rx="3" />
      <path d="M2.5 8h15M8 8v9" />
      <circle cx="12.8" cy="12.4" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
