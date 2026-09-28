import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { User } from '@/types/User';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchIcon, PencilIcon, Trash2Icon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { useAdmin } from '@/hooks/admin.hook';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {[...Array(rows)].map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className="max-md:hidden">
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-[50px]" />
          </TableCell>
          <TableCell>
            <div className="flex space-x-2">
              <Skeleton className="size-9" />
              <Skeleton className="size-9" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/** Account management (the former /users page), shown as the "Gebruikers" tab of the Beheer dialog. */
export default function UsersPanel() {
  const user = useAuthUser<User>();
  const { users, isLoading, updateUser, createUser, deleteUser } = useAdmin();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  const usersPerPage = 10;
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  }

  const filteredUsers = users?.filter((user: User) => user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  function handleDelete(user: User) {
    setSelectedUser(user);
    setIsConfirmDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!selectedUser) return;
    const result = await deleteUser(selectedUser._id);
    setIsConfirmDeleteDialogOpen(false);
    if (!result) {
      toast.error('Er is een fout opgetreden', { description: 'De gebruiker kon niet worden verwijderd.' });
    } else {
      toast.success('Gebruiker verwijderd', { description: 'De gebruiker is succesvol verwijderd.' });
    }
  }

  function handleEdit(user: User) {
    setSelectedUser(user);
    setIsDialogOpen(true);
  }

  function handleCreate() {
    setSelectedUser({ name: '', email: '', admin: false } as User);
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!selectedUser) return;
    let result: boolean;
    if (selectedUser?._id) {
      result = await updateUser(selectedUser);
    } else {
      result = await createUser(selectedUser);
    }
    setIsDialogOpen(false);
    if (!result) {
      toast.error('Er is een fout opgetreden', { description: 'De gebruiker kon niet worden opgeslagen.' });
    } else {
      toast.success('Gebruiker opgeslagen', { description: 'De gebruiker is succesvol opgeslagen.' });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex items-center">
          <SearchIcon className="absolute ml-2 h-4 w-4 text-gray-500" />
          <Input type="text" placeholder="Zoek gebruikers..." value={searchTerm} onChange={handleSearch} className="pl-8" />
        </div>
        <Button onClick={handleCreate}>Nieuwe gebruiker</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Naam</TableHead>
            <TableHead className="w-[45%] max-md:hidden">E-mailadres</TableHead>
            <TableHead className="w-[10%]">Admin</TableHead>
            <TableHead className="w-[10%]">Acties</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <LoadingSkeleton rows={usersPerPage} />
          ) : (
            filteredUsers.slice(indexOfFirstUser, indexOfLastUser).map((user) => (
              <TableRow key={user._id}>
                <TableCell>{user.name}</TableCell>
                <TableCell className="max-md:hidden">{user.email}</TableCell>
                <TableCell>{user.admin ? 'Ja' : 'Nee'}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(user)}>
                      <PencilIcon />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(user)}>
                      <Trash2Icon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between text-sm">
        {isLoading ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <div>
            {indexOfFirstUser + 1} tot {Math.min(indexOfLastUser, filteredUsers.length)} van {filteredUsers.length} gebruikers
          </div>
        )}
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" onClick={() => setCurrentPage(currentPage + 1)} disabled={indexOfLastUser >= filteredUsers.length}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      {/* Confirm delete dialog */}
      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je zeker dat je deze gebruiker wilt verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Deze actie kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit / create user dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?._id ? 'Bewerk gebruiker' : 'Nieuwe gebruiker'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Naam
              </Label>
              <Input
                id="name"
                required
                value={selectedUser?.name || ''}
                className="col-span-3"
                onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value } as User)}
                autoComplete="off"
                data-1p-ignore
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                E-mailadres
              </Label>
              <Input
                id="email"
                required
                type="email"
                value={selectedUser?.email || ''}
                className="col-span-3"
                onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value } as User)}
                autoComplete="off"
                data-1p-ignore
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Wachtwoord
              </Label>
              <Input
                id="password"
                type="password"
                value={selectedUser?.password || ''}
                className="col-span-3"
                onChange={(e) => setSelectedUser({ ...selectedUser, password: e.target.value } as User)}
                placeholder={selectedUser?._id && 'Laat leeg om niet te wijzigen'}
                autoComplete="off"
                data-1p-ignore
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="admin" className="text-right">
                Admin
              </Label>
              <Switch
                id="admin"
                checked={selectedUser?.admin || false}
                onCheckedChange={(e) => setSelectedUser({ ...selectedUser, admin: e } as User)}
                disabled={selectedUser?._id === user?._id}
              />
            </div>
          </div>
          <Button onClick={handleSave}>Opslaan</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
