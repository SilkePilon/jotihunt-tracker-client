import type { Worker } from 'tesseract.js';
import { extractHuntCode } from './hunt-reports';

let workerPromise: Promise<Worker> | null = null;

/**
 * One shared Tesseract worker, created on first use (loads the wasm core and the `eng` data, cached by the
 * browser afterwards). Recognition runs in the browser: the photo never leaves the device for OCR.
 */
function getWorker(): Promise<Worker> {
  workerPromise ??= import('tesseract.js').then(async ({ createWorker }) => {
    const worker = await createWorker('eng');
    await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' });
    return worker;
  });
  workerPromise.catch(() => {
    workerPromise = null;
  });
  return workerPromise;
}

/** Read the hunt code from a photo; '' when OCR fails or finds nothing. */
export async function readHuntCode(image: Blob): Promise<string> {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return extractHuntCode(data.text);
  } catch {
    return '';
  }
}
