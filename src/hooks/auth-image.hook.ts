import { useEffect, useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetchAuthBlob } from '@/lib/swr';

/**
 * Load an image from the API with the auth header (an <img src> can't send it) and return an object URL.
 * The URL is revoked when the path changes or the component unmounts.
 */
export function useAuthImage(path: string | null): string | undefined {
  const authHeader = useAuthHeader() || '';
  const [image, setImage] = useState<{ path: string; url: string } | undefined>(undefined);

  useEffect(() => {
    if (!path) return;
    let objectUrl: string | undefined;
    let cancelled = false;
    fetchAuthBlob(path, authHeader)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ path, url: objectUrl });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, authHeader]);

  return image && image.path === path ? image.url : undefined;
}
