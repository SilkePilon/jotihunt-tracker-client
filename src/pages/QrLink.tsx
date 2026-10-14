import { Navigate, useParams } from 'react-router';
import useIsAuthenticated from 'react-auth-kit/hooks/useIsAuthenticated';

/** A phone opened a laptop's QR code: confirm on the map, or log in first and come back. */
export default function QrLink() {
  const { code = '' } = useParams();
  const isAuthenticated = useIsAuthenticated();
  if (!isAuthenticated) return <Navigate to={`/login?next=${encodeURIComponent(`/l/${code}`)}`} replace />;
  return <Navigate to="/" replace state={{ qrLogin: code }} />;
}
