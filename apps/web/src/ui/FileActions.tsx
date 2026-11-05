import { useRef, useState } from 'react';
import { editor } from '../plan/session';
import { activePlan } from '../plan/PlanCanvas';
import { fileNameFor, MAX_FILE_BYTES, parseSceneFile, serializeScene } from '../lib/persistence';
import { useUi } from '../plan/session';
import { buildTemplate } from '../plan/templates';
import { useCloud } from '../cloud/store';

/** Save to / open from a file, and start a new home (two taps, so it can't happen by accident). */
export function FileActions({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  const refit = () => {
    activePlan?.fitToPlan();
    useUi.getState().bumpFit();
  };

  const save = () => {
    const scene = editor.getState().scene;
    const url = URL.createObjectURL(new Blob([serializeScene(scene)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameFor(scene);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMessage('Saved to your downloads.');
  };

  const open = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setMessage('That file is too large to be a home.');
    const r = parseSceneFile(await file.text());
    if (!r.ok) return setMessage(r.error);
    editor.loadScene(r.scene);
    refit();
    setMessage(null);
    onDone();
  };

  return (
    <div className="file-actions">
      <div className="fa-row">
        <button type="button" className="pill small" onClick={save}>
          Save to file
        </button>
        <button type="button" className="pill small" onClick={() => input.current?.click()}>
          Open file
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void open(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <button
        type="button"
        className={`pill small${confirmNew ? ' solid' : ''}`}
        onClick={() => {
          if (!confirmNew) return setConfirmNew(true);
          useCloud.getState().detach();
          editor.loadScene(buildTemplate('blank'));
          setConfirmNew(false);
          refit();
          onDone();
          useUi.getState().setWelcomeOpen(true);
        }}
        onBlur={() => setConfirmNew(false)}
      >
        {confirmNew ? 'Tap again to clear everything' : 'New home'}
      </button>
      <button
        type="button"
        className="pill small"
        onClick={() => {
          useUi.getState().setHelpOpen(true);
          onDone();
        }}
      >
        Help &amp; shortcuts
      </button>
      {message && (
        <small className="fine" role="status">
          {message}
        </small>
      )}
      <small className="fine">Your home is also saved automatically in this browser.</small>
    </div>
  );
}
