import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { EllipsisIcon, LifeBuoyIcon, PencilIcon, ShieldIcon, ShieldOffIcon, Trash2Icon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import ConfirmDialog from '@/components/ConfirmDialog';
import RecoveryLinkDialog from '@/components/admin/RecoveryLinkDialog';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAdmin } from '@/hooks/admin.hook';
import { useNow } from '@/hooks/now.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { splitUsers, userMeta } from '@/lib/beheer';
import { SWAP } from '@/lib/motion';
import type { User } from '@/types/User';
import { BeheerGroup, BeheerPane, BeheerRow, BeheerSkeleton } from './BeheerLayout';
import RenameUserDialog from './RenameUserDialog';

/** The pane's flex gap (gap-7), so a group folding away doesn't leave a gap behind */
const GROUP_GAP = 28;

/** Beheer → Gebruikers: admins and members, each with a ⋯ menu (herstel-link, rename, admin, delete). */
export default function UsersPane() {
  const me = useAuthUser<User>();
  const { users, isError, updateUser, deleteUser, createRecoveryLink } = useAdmin();
  const now = useNow(true);
  // The dialogs keep their user while they fade out
  const [recoveryUser, setRecoveryUser] = useState<User | null>(null);
  const [renaming, setRenaming] = useState<User | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const view = users ? 'content' : isError ? 'error' : 'loading';
  const { admins, members } = splitUsers(users ?? []);
  const count = users?.length ?? 0;

  async function toggleAdmin(user: User) {
    const error = await updateUser({ ...user, admin: !user.admin });
    if (error) toast.error(apiErrorMessage(error, 'Opslaan is mislukt.'));
    else toast.success(user.admin ? `${user.name} is geen admin meer` : `${user.name} is nu admin`);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const error = await deleteUser(deleting._id);
    setDeleteOpen(false);
    if (error) toast.error(apiErrorMessage(error, 'De gebruiker kon niet worden verwijderd.'));
    else toast.success(`${deleting.name} verwijderd`);
  }

  function row(user: User) {
    const isMe = user._id === me?._id;
    return (
      <BeheerRow
        key={user._id}
        title={
          <>
            {user.name}
            {isMe && <span className="font-normal text-muted-foreground"> (jij)</span>}
          </>
        }
        meta={userMeta(user, now)}
      >
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Opties voor ${user.name}`}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRecoveryUser(user)}>
              <LifeBuoyIcon />
              Herstel-link maken
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setRenaming(user);
                setRenameOpen(true);
              }}
            >
              <PencilIcon />
              Naam wijzigen
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isMe} onSelect={() => void toggleAdmin(user)}>
              {user.admin ? <ShieldOffIcon /> : <ShieldIcon />}
              {user.admin ? 'Admin afnemen' : 'Admin maken'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isMe}
              onSelect={() => {
                setDeleting(user);
                setDeleteOpen(true);
              }}
            >
              <Trash2Icon />
              Verwijderen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </BeheerRow>
    );
  }

  return (
    <BeheerPane
      title="Gebruikers"
      description={
        view === 'content' ? `${count === 1 ? '1 account' : `${count} accounts`}. Nieuwe mensen komen binnen via een invite.` : 'Nieuwe mensen komen binnen via een invite.'
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton groups={2} />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.p key="error" className="text-sm text-muted-foreground" {...SWAP}>
            Kan de gebruikers niet laden.
          </motion.p>
        )}
        {view === 'content' && (
          <motion.div key="content" className="flex flex-col gap-7" {...SWAP}>
            <Reveal gap={GROUP_GAP}>
              {admins.length > 0 && (
                <BeheerGroup title="Admins">
                  <AnimatePresence initial={false}>{admins.map(row)}</AnimatePresence>
                </BeheerGroup>
              )}
            </Reveal>
            <Reveal gap={GROUP_GAP}>
              {members.length > 0 && (
                <BeheerGroup title="Leden">
                  <AnimatePresence initial={false}>{members.map(row)}</AnimatePresence>
                </BeheerGroup>
              )}
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>

      <RecoveryLinkDialog user={recoveryUser} onClose={() => setRecoveryUser(null)} createLink={createRecoveryLink} />
      <RenameUserDialog open={renameOpen} user={renaming} onOpenChange={setRenameOpen} updateUser={updateUser} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`${deleting?.name} verwijderen?`}
        description="Het account en alle sessies worden verwijderd. Dit kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijderen"
        destructive
        onConfirm={confirmDelete}
      />
    </BeheerPane>
  );
}
