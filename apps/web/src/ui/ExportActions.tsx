import { useState } from 'react';
import { useStore } from 'zustand';
import { editor } from '../plan/session';
import { downloadBlob } from '../export/files';
import { ExportError, makeDxf, makePdf, makePicture } from '../export/make';
import type { Paper } from '../export/pdfPlan';
import { useCloud } from '../cloud/store';
import { Segmented } from './fields';

/** Home › Export: a picture of the 3D view, a scaled PDF plan (one page per floor) and a DXF for CAD programs. */
export function ExportActions() {
  const [paper, setPaper] = useState<Paper>('A4');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const floors = useStore(editor.store, (s) => s.scene.levelOrder.length);
  const ent = useCloud((s) => s.ent);
  /** Blueprint files (PDF plan, DXF) and a clean 3D picture need Premium: a subscription or a redeem code. */
  const premium = !!(ent.subscribed || ent.gifted);
  const ask = () => {
    useCloud.getState().setAccountOpen(true);
    return 'The blueprint (PDF and CAD) is a Premium feature. Go ad-free in your account, or redeem a code.';
  };

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch (e) {
      setMessage(e instanceof ExportError ? e.message : 'Could not create the file. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const png = () => run(async () => {
    const f = await makePicture(premium);
    downloadBlob(f.blob, f.name);
    return f.note;
  });

  const pdf = () =>
    run(async () => {
      if (!premium) return ask();
      const f = makePdf(paper);
      downloadBlob(f.blob, f.name);
      return `Saved ${f.note}`;
    });

  const dxf = () =>
    run(async () => {
      if (!premium) return ask();
      const f = makeDxf();
      downloadBlob(f.blob, f.name);
      return `Saved the ${f.note}`;
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
          Plan (PDF){premium ? '' : ' 🔒'}
        </button>
        <button type="button" className="pill small" disabled={busy} onClick={dxf} title="For AutoCAD and other CAD programs">
          CAD (DXF){premium ? '' : ' 🔒'}
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
