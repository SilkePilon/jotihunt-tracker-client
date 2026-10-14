import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes as RouterRoutes, Route } from 'react-router';
import AuthOutlet from '@auth-kit/react-router/AuthOutlet';
import Users from './pages/Users';
import Hints from './pages/Hints';

// Split per page: the login page should not download the map, and the map page not the login page
const Layout = lazy(() => import('./Layout'));
const App = lazy(() => import('./pages/App'));
const Hq = lazy(() => import('./pages/Hq'));
const Login = lazy(() => import('./pages/Login'));
const Invite = lazy(() => import('./pages/Invite'));
const Herstel = lazy(() => import('./pages/Herstel'));
const QrLink = lazy(() => import('./pages/QrLink'));

export default function Routes() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <RouterRoutes>
          <Route element={<AuthOutlet fallbackPath="/login" />}>
            <Route path="/hq" element={<Hq />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<App />} />
              <Route path="/users" element={<Users />} />
              <Route path="/hints" element={<Hints />} />
            </Route>
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:code" element={<Invite />} />
          <Route path="/herstel/:token" element={<Herstel />} />
          <Route path="/l/:code" element={<QrLink />} />
        </RouterRoutes>
      </Suspense>
    </BrowserRouter>
  );
}
