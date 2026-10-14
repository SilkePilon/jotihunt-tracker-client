import { toast } from 'sonner';

/**
 * Copy text to the clipboard without any toast. The clipboard API needs a secure context (https), permission and
 * (on iOS Safari) a fresh user gesture, so this can fail.
 * @returns true when the text was copied
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy text to the clipboard with a toast either way. The clipboard API needs a secure context (https) and
 * permission, so this can fail.
 * @param successDescription optional second line under the success toast
 * @returns true when the text was copied
 */
export async function copyToClipboard(text: string, successMessage = 'Gekopieerd', successDescription?: string): Promise<boolean> {
  if (await writeClipboard(text)) {
    toast.success(successMessage, successDescription ? { description: successDescription } : undefined);
    return true;
  }
  toast.error('Kopiëren mislukt');
  return false;
}
