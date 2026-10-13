import { useEffect, useState } from 'react';
import axios from 'axios';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';

/** A loaded member photo: an object URL for <img> and the decoded image for the map's canvas. */
export interface Life360Avatar {
  url: string;
  image: HTMLImageElement;
}

/*
 * The API authenticates with an Authorization header, which <img src> and canvas image loads can't send. Each avatar
 * is fetched once as a blob with the header and shared by the card and the map. Kept for the session (a circle has
 * a handful of members); a failed load is forgotten, so the next poll tries again.
 */
const pending = new Map<string, Promise<Life360Avatar | null>>();
const loaded = new Map<string, Life360Avatar>();

async function fetchAvatar(path: string, authHeader: string): Promise<Life360Avatar> {
  // Dev fixtures use data URLs; everything else is '/life360/avatar/<id>' relative to the API base
  const url = path.startsWith('data:')
    ? path
    : URL.createObjectURL((await axios.get<Blob>(`${import.meta.env.API_BASE_URL}${path}`, { headers: { Authorization: authHeader }, responseType: 'blob' })).data);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    // Not an image (or a broken one): free the blob, the next poll fetches it again
    if (url !== path) URL.revokeObjectURL(url);
    throw error;
  }
  return { url, image };
}

/** Load (once) the avatar at `path`; null when it fails. Never rejects. */
export function loadLife360Avatar(path: string, authHeader: string): Promise<Life360Avatar | null> {
  let promise = pending.get(path);
  if (!promise) {
    promise = fetchAvatar(path, authHeader).then(
      (avatar) => {
        loaded.set(path, avatar);
        return avatar;
      },
      () => {
        pending.delete(path);
        return null;
      },
    );
    pending.set(path, promise);
  }
  return promise;
}

/** The avatar at `path` if it has finished loading. */
export function getLife360Avatar(path: string): Life360Avatar | undefined {
  return loaded.get(path);
}

/** Object URL of a member's photo for an <img>, undefined while loading, without photo or after an error. */
export function useLife360Avatar(path: string | null): string | undefined {
  const authHeader = useAuthHeader() || '';
  const [, setLoadedCount] = useState(0);

  useEffect(() => {
    if (!path || loaded.has(path)) return;
    let cancelled = false;
    void loadLife360Avatar(path, authHeader).then((avatar) => {
      if (!cancelled && avatar) setLoadedCount((count) => count + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [path, authHeader]);

  return path ? loaded.get(path)?.url : undefined;
}

/** Load all `paths`; returns the set of paths whose image is ready (a new set whenever one more finishes). */
export function useLife360Avatars(paths: readonly string[]): ReadonlySet<string> {
  const authHeader = useAuthHeader() || '';
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set(paths.filter((path) => loaded.has(path))));
  const key = paths.join('\n');

  useEffect(() => {
    let cancelled = false;
    for (const path of key ? key.split('\n') : []) {
      void loadLife360Avatar(path, authHeader).then((avatar) => {
        if (!cancelled && avatar) setReady((previous) => (previous.has(path) ? previous : new Set(previous).add(path)));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [key, authHeader]);

  return ready;
}
