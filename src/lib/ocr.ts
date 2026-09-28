import type { PSM, Worker } from 'tesseract.js';
import { codeCandidate, extractHuntCode, voteHuntCode, type OcrWord } from './hunt-reports';
import { canvasToBlob, cropSticker } from './image';

let workerPromise: Promise<Worker> | null = null;

/**
 * One shared Tesseract worker, created on first use (loads the wasm core and the `eng` data, cached by the
 * browser afterwards). Recognition runs in the browser: the photo never leaves the device for OCR.
 */
function getWorker(): Promise<Worker> {
  workerPromise ??= import('tesseract.js').then(({ createWorker }) => createWorker('eng'));
  workerPromise.catch(() => {
    workerPromise = null;
  });
  return workerPromise;
}

/** Page segmentation modes: automatic for the whole photo; one block / sparse text for the cropped sticker. */
const AUTO = '3' as PSM;
const SINGLE_BLOCK = '6' as PSM;
const SPARSE_TEXT = '11' as PSM;
/** Widths the cropped sticker is scaled to; each size + mode is one OCR pass that votes on the code. */
const STICKER_WIDTHS = [1200, 1800];

export interface HuntCodeReading {
  /** Best guess of the (case-sensitive) code, '' when nothing was read */
  code: string;
  /** The cropped sticker, to show next to the code field for checking; null when no sticker was found */
  sticker: Blob | null;
}

/** Rounded box around the recognised code on the sticker preview, so the user sees what was read. */
function drawCodeBox(canvas: HTMLCanvasElement, box: NonNullable<OcrWord['bbox']>) {
  const context = canvas.getContext('2d')!;
  const padding = Math.round(canvas.width * 0.015);
  const x = Math.max(0, box.x0 - padding);
  const y = Math.max(0, box.y0 - padding);
  const width = Math.min(canvas.width, box.x1 + padding) - x;
  const height = Math.min(canvas.height, box.y1 + padding) - y;
  context.strokeStyle = '#f97316';
  context.lineWidth = Math.max(3, Math.round(canvas.width / 240));
  context.beginPath();
  context.roundRect(x, y, width, height, Math.round(height * 0.18));
  context.stroke();
}

async function recognizeWords(worker: Worker, image: HTMLCanvasElement | Blob, mode: PSM): Promise<{ words: OcrWord[]; text: string }> {
  await worker.setParameters({ tessedit_pageseg_mode: mode });
  const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
  const words: OcrWord[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) for (const line of paragraph.lines) for (const word of line.words) words.push({ text: word.text, confidence: word.confidence, bbox: word.bbox });
  }
  return { words, text: data.text };
}

/**
 * Read the hunt code from a photo. Several passes (whole photo, and the cropped sticker at two sizes in two
 * segmentation modes) each propose their most confident code-shaped word; a confidence-weighted vote per character
 * combines them. Never throws: returns an empty code when OCR fails.
 */
export async function readHuntCode(photo: Blob): Promise<HuntCodeReading> {
  try {
    const worker = await getWorker();
    const candidates: OcrWord[] = [];
    const whole = await recognizeWords(worker, photo, AUTO);
    const wholeCandidate = codeCandidate(whole.words);
    if (wholeCandidate) candidates.push(wholeCandidate);

    // The first (smallest) crop is also the preview; remember where the code was found on it
    let preview: { canvas: HTMLCanvasElement; candidates: OcrWord[] } | null = null;
    for (const width of STICKER_WIDTHS) {
      const crop = await cropSticker(photo, width);
      if (!crop) break;
      const cropCandidates: OcrWord[] = [];
      for (const mode of [SINGLE_BLOCK, SPARSE_TEXT]) {
        const candidate = codeCandidate((await recognizeWords(worker, crop, mode)).words);
        if (candidate) cropCandidates.push(candidate);
      }
      candidates.push(...cropCandidates);
      preview ??= { canvas: crop, candidates: cropCandidates };
    }

    const code = voteHuntCode(candidates) || extractHuntCode(whole.text);
    if (!preview) return { code, sticker: null };
    const located = preview.candidates.find((candidate) => candidate.text === code) ?? [...preview.candidates].sort((a, b) => b.confidence - a.confidence)[0];
    if (located?.bbox) drawCodeBox(preview.canvas, located.bbox);
    return { code, sticker: await canvasToBlob(preview.canvas) };
  } catch {
    const worker = workerPromise;
    workerPromise = null;
    worker?.then((instance) => instance.terminate()).catch(() => undefined);
    return { code: '', sticker: null };
  }
}
