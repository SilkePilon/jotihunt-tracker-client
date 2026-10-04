import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { LogOutIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import PasswordChangeForm from './PasswordChangeForm';
import { useAuth } from '@/hooks/auth.hook';
import { useLogout } from '@/hooks/logout.hook';
import { useTheme } from '@/hooks/theme.hook';
import { onPasswordChangeRequired } from '@/lib/password-change';
import type { User } from '@/types/User';

/**
 * Between login and the app (map and HQ screen): a user with an admin-set password sees only the password change
 * screen. Nothing else mounts (no polling, push resync, notifications or tour); the server refuses everything else
 * anyway. A PASSWORD_CHANGE_REQUIRED answer while the app is open switches to this screen without signing out.
 */
export default function PasswordChangeGate() {
  const authUser = useAuthUser<User>();
  const { updateUserState } = useAuth();
  // Own state: react-auth-kit stores the user in a mutable object, so signing in again does not re-render this
  const [mustChange, setMustChange] = useState(!!authUser?.requiresPasswordChange);

  const latest = useRef({ authUser, updateUserState });
  useEffect(() => {
    latest.current = { authUser, updateUserState };
  });

  useEffect(
    () =>
      onPasswordChangeRequired(() => {
        setMustChange(true);
        // Also in the stored session, so a reload shows the change screen right away
        const { authUser, updateUserState } = latest.current;
        if (authUser && !authUser.requiresPasswordChange) void updateUserState({ ...authUser, requiresPasswordChange: true });
      }),
    [],
  );

  // updatePassword already signed in with the fresh token and requiresPasswordChange false
  if (mustChange) return <PasswordChangeScreen onChanged={() => setMustChange(false)} />;
  return <Outlet />;
}

function PasswordChangeScreen({ onChanged }: { onChanged: () => void }) {
  const logout = useLogout();
  useTheme();

  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Wachtwoord wijzigen</CardTitle>
          <CardDescription>
            Je wachtwoord is ingesteld door de organisatie. Kies een eigen wachtwoord om verder te gaan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PasswordChangeForm onSuccess={onChanged} />
          <Button variant="ghost" onClick={logout}>
            <LogOutIcon />
            Uitloggen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
