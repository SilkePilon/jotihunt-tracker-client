import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes as RouterRoutes, Route } from 'react-router';
import AuthOutlet from '@auth-kit/react-router/AuthOutlet';
import Users from './pages/Users';
import Hints from './pages/Hints';
import PasswordChangeGate from './components/PasswordChangeGate';

// Split per page: the login page should not download the map, and the map page not the login page
const Layout = lazy(() => import('./Layout'));
const App = lazy(() => import('./pages/App'));
const Hq = lazy(() => import('./pages/Hq'));
const Login = lazy(() => import('./pages/Login'));

export default function Routes() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <RouterRoutes>
          <Route element={<AuthOutlet fallbackPath="/login" />}>
            {/* An admin-set password must be changed first: until then only that screen mounts, for every page */}
            <Route element={<PasswordChangeGate />}>
              <Route path="/hq" element={<Hq />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<App />} />
                <Route path="/users" element={<Users />} />
                <Route path="/hints" element={<Hints />} />
              </Route>
            </Route>
          </Route>
          <Route path="/login" element={<Login />} />
        </RouterRoutes>
      </Suspense>
    </BrowserRouter>
  );
}
