import { editor, useUi } from '../plan/session';
import { fileNameFor, serializeScene } from '../lib/persistence';
import { capture3D, hasCapture } from './capture3d';
import { planDxf } from './dxf';
import { downloadBlob, exportBaseName } from './files';
import { planPdf, type Paper } from './pdfPlan';
import { addWatermark } from './watermark';

/** A finished file plus a one-line note for the person who asked for it. */
export interface MadeFile {
  blob: Blob;
  name: string;
  note: string;
}

/** A problem worth showing to the person as it is. */
export class ExportError extends Error {}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

export type ExportKind = 'project' | 'picture' | 'pdf' | 'dxf';

/** Blueprint files and a clean picture need Premium. */
export const needsPremium = (k: ExportKind) => k === 'pdf' || k === 'dxf';

export function makeProject(): MadeFile {
  const scene = editor.getState().scene;
  return {
    blob: new Blob([serializeScene(scene)], { type: 'application/json' }),
    name: fileNameFor(scene),
    note: 'Your home file. Open it again from Home › Open file.',
  };
}

export async function makePicture(premium: boolean): Promise<MadeFile> {
  const ui = useUi.getState();
  if (ui.view === '2d') ui.setView('split'); // the picture is taken from the 3D view
  for (let i = 0; i < 40 && !hasCapture(); i++) await sleep(100);
  await sleep(700);
  const blob = await capture3D();
  if (!blob) throw new ExportError('The 3D view is not ready yet. Open it and try again.');
  return {
    blob: premium ? blob : await addWatermark(blob),
    name: `${exportBaseName(editor.getState().scene)}-3d.png`,
    note: premium ? '3D picture ready.' : '3D picture ready (free version, with a small mark). Premium removes it.',
  };
}

export function makePdf(paper: Paper): MadeFile {
  const scene = editor.getState().scene;
  const r = planPdf(scene, paper);
  return {
    blob: new Blob([r.bytes as BlobPart], { type: 'application/pdf' }),
    name: `${exportBaseName(scene)}-plan-${paper}.pdf`,
    note: `${r.pages.length} ${r.pages.length === 1 ? 'page' : 'pages'} at 1 : ${[...new Set(r.pages.map((p) => p.scale))].join(' / 1 : ')}.`,
  };
}

export function makeDxf(): MadeFile {
  const scene = editor.getState().scene;
  return {
    blob: new Blob([planDxf(scene)], { type: 'application/dxf' }),
    name: `${exportBaseName(scene)}.dxf`,
    note: 'CAD drawing (millimetres, one layer set per floor).',
  };
}

export const canShareFiles = (f: File): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });

/** Hand a finished file to the phone's / computer's share sheet; where there is none, save it instead. Returns what happened. */
export async function shareFile(file: MadeFile): Promise<'shared' | 'saved' | 'cancelled'> {
  const f = new File([file.blob], file.name, { type: file.blob.type });
  if (canShareFiles(f)) {
    try {
      await navigator.share({ files: [f], title: file.name });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(file.blob, file.name);
  return 'saved';
}
