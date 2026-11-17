/** A lazy chunk that failed to download (offline, or a new deploy removed the old file): a reload fixes it. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically imported/i.test(`${error.name} ${error.message}`);
}
