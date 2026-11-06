import { useState } from 'react';
import { useStore } from 'zustand';
import { editor, useUi } from '../plan/session';
import { capture3D, hasCapture } from '../export/capture3d';
import { planDxf } from '../export/dxf';
import { downloadBlob, exportBaseName } from '../export/files';
import { planPdf, type Paper } from '../export/pdfPlan';
import { Segmented } from './fields';

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Home › Export: a picture of the 3D view, a scaled PDF plan (one page per floor) and a DXF for CAD programs. */
export function ExportActions() {
  const [paper, setPaper] = useState<Paper>('A4');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const floors = useStore(editor.store, (s) => s.scene.levelOrder.length);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch {
      setMessage('Could not create the file. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const png = () =>
    run(async () => {
      const ui = useUi.getState();
      if (ui.view === '2d') ui.setView('split'); // the picture is taken from the 3D view
      for (let i = 0; i < 40 && !hasCapture(); i++) await sleep(100);
      await sleep(700); // let the view draw its first frame
      const blob = await capture3D();
      if (!blob) return 'The 3D view is not ready yet. Open it and try again.';
      downloadBlob(blob, `${exportBaseName(editor.getState().scene)}-3d.png`);
      return 'Saved the 3D picture to your downloads.';
    });

  const pdf = () =>
    run(async () => {
      const scene = editor.getState().scene;
      const r = planPdf(scene, paper);
      downloadBlob(new Blob([r.bytes as BlobPart], { type: 'application/pdf' }), `${exportBaseName(scene)}-plan-${paper}.pdf`);
      return `Saved ${r.pages.length} ${r.pages.length === 1 ? 'page' : 'pages'} at 1 : ${[...new Set(r.pages.map((p) => p.scale))].join(' / 1 : ')}.`;
    });

  const dxf = () =>
    run(async () => {
      const scene = editor.getState().scene;
      downloadBlob(new Blob([planDxf(scene)], { type: 'application/dxf' }), `${exportBaseName(scene)}.dxf`);
      return 'Saved the CAD drawing (millimetres, one layer set per floor).';
    });

  return (
    <div className="file-actions">
      <Segmented
        label="Paper"
        value={paper}
        options={[
          { id: 'A4', label: 'A4' },
          { id: 'A3', label: 'A3' },
        ]}
        onChange={setPaper}
      />
      <div className="fa-row">
        <button type="button" className="pill small" disabled={busy} onClick={() => void png()} title="A high-resolution picture of the 3D view">
          3D picture
        </button>
        <button type="button" className="pill small" disabled={busy} onClick={pdf} title={`Scaled plan, ${floors} ${floors === 1 ? 'page' : 'pages'}`}>
          Plan (PDF)
        </button>
        <button type="button" className="pill small" disabled={busy} onClick={dxf} title="For AutoCAD and other CAD programs">
          CAD (DXF)
        </button>
      </div>
      {message && (
        <small className="fine" role="status">
          {message}
        </small>
      )}
    </div>
  );
}
