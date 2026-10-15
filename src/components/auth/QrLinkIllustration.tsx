import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/** One dash plus its gap (5 + 6): the offset loops over two of these, so the march is seamless */
const DASH_PERIOD = 11;

/**
 * Laptop with a QR code, a dashed link marching towards the phone, and the phone in primary: "this phone confirms
 * that laptop". `animated` is off for the loading skeleton; reduced motion keeps the line still too.
 */
export default function QrLinkIllustration({ animated = true, className }: { animated?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const march = animated && !reduce;

  return (
    <div aria-hidden className={cn('flex items-center justify-center gap-2.5 pt-1.5 pb-3.5', className)}>
      <svg width={64} height={44} viewBox="0 0 64 44" className="shrink-0">
        <rect x={8} y={2} width={48} height={32} rx={4} strokeWidth={2} className="fill-beheer-row-high stroke-muted-foreground" />
        <rect x={2} y={36} width={60} height={6} rx={3} className="fill-muted-foreground" />
        <rect x={24} y={10} width={16} height={16} rx={2} fill="none" strokeWidth={2} className="stroke-foreground" />
        <path d="M28 14h3v3h-3zM33 19h3v3h-3z" className="fill-foreground" />
      </svg>
      <svg width={70} height={10} viewBox="0 0 70 10" className="shrink-0">
        <motion.path
          d="M2 5h66"
          strokeWidth={2.5}
          strokeDasharray="5 6"
          strokeLinecap="round"
          className="stroke-primary"
          initial={{ strokeDashoffset: DASH_PERIOD * 2 }}
          animate={march ? { strokeDashoffset: 0 } : { strokeDashoffset: DASH_PERIOD * 2 }}
          transition={march ? { duration: 1, ease: 'linear', repeat: Infinity } : { duration: 0 }}
        />
      </svg>
      <svg width={32} height={52} viewBox="0 0 32 52" className="shrink-0">
        <rect x={2} y={2} width={28} height={48} rx={6} strokeWidth={2} className="fill-beheer-row-high stroke-primary" />
        <circle cx={16} cy={26} r={7} className="fill-primary" />
      </svg>
    </div>
  );
}
