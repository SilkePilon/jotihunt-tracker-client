import { useLife360Avatar } from '@/hooks/life360-avatar.hook';
import { initialsColor } from '@/lib/life360';
import { cn } from '@/lib/utils';
import type { Life360Member } from '@/types/Life360';

/** Round member photo, or the initials on a stable colour (while loading and without photo). */
export default function Life360Avatar({ member, size, className }: { member: Pick<Life360Member, 'id' | 'initials' | 'avatarUrl'>; size: number; className?: string }) {
  const src = useLife360Avatar(member.avatarUrl);
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: src ? undefined : initialsColor(member.id) }}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : member.initials}
    </span>
  );
}
