import { toast } from 'sonner';

/**
 * Copy text to the clipboard with a toast either way. The clipboard API needs a secure context (https) and
 * permission, so this can fail.
 * @returns true when the text was copied
 */
export async function copyToClipboard(text: string, successMessage = 'Gekopieerd'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error('Kopiëren mislukt');
    return false;
  }
}
