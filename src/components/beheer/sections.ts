import { MapPinIcon, MegaphoneIcon, PlugIcon, SlidersHorizontalIcon, SparklesIcon, UserPlusIcon, UsersIcon } from 'lucide-react';
import type { AdminDialogId } from '@/stores/admin.store';
import type { NavIcon } from './WindowNav';

/** Beheer's sections in nav order, with their icons: the window's nav and the phone menu's Beheer card. */
export const BEHEER_SECTIONS: { id: AdminDialogId; title: string; icon: NavIcon }[] = [
  { id: 'algemeen', title: 'Algemeen', icon: SlidersHorizontalIcon },
  { id: 'ai', title: 'AI', icon: SparklesIcon },
  { id: 'users', title: 'Gebruikers', icon: UsersIcon },
  { id: 'invites', title: 'Invites', icon: UserPlusIcon },
  { id: 'hunters', title: 'Hunters', icon: MapPinIcon },
  { id: 'broadcast', title: 'Bericht versturen', icon: MegaphoneIcon },
  { id: 'koppelingen', title: 'Koppelingen', icon: PlugIcon },
];
