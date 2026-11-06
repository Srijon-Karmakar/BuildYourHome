import { useEffect } from 'react';
import { getAsset, itemFootprint } from '@hd/assets';
import { layoutItems, ROOM_PRESETS, type RoomPreset } from '@hd/editor-core';
import { useUi } from '../plan/session';
import { formatLength } from '../lib/units';
import { useStore } from 'zustand';
import { editor } from '../plan/session';

/** A tiny floor-plan picture of a preset: its walls and the footprint of every piece of furniture. */
function Mini({ preset }: { preset: RoomPreset }) {
  const pad = 0.25;
  const vw = preset.w + pad * 2;
  const vd = preset.d + pad * 2;
  const items = layoutItems(preset).flatMap((it) => {
    const a = getAsset(it.asset);
    return a ? [itemFootprint(a, it.pos, it.rot, [1, 1, 1]).map((p) => `${(p[0] + preset.w / 2 + pad).toFixed(2)},${(p[1] + preset.d / 2 + pad).toFixed(2)}`).join(' ')] : [];
  });
  return (
    <svg viewBox={`0 0 ${vw} ${vd}`} className="room-mini" aria-hidden="true">
      <rect x={pad} y={pad} width={preset.w} height={preset.d} fill="#ddd5c2" stroke="#111" strokeWidth="0.22" />
      {items.map((pts, i) => (
        <polygon key={i} points={pts} fill="#fbfaf7" stroke="#444" strokeWidth="0.04" />
      ))}
    </svg>
  );
}

/** Ready-made, furnished rooms: pick one, then click on the plan to put it down (R turns it). */
export function RoomsPanel() {
  const open = useUi((s) => s.roomsOpen);
  const setOpen = useUi((s) => s.setRoomsOpen);
  const startRoom = useUi((s) => s.startRoom);
  const units = useStore(editor.store, (s) => s.scene.meta.units);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <aside className="furniture rooms" aria-label="Ready-made rooms">
      <header>
        <strong>Ready-made rooms</strong>
        <button type="button" className="ins-close" aria-label="Close" onClick={() => setOpen(false)}>
          ×
        </button>
      </header>
      <p className="fine" style={{ margin: '0 16px 8px' }}>
        Pick a room, then click on the plan to place it. R turns it. Rooms placed side by side share their wall.
      </p>
      <div className="fp-grid rooms-grid">
        {ROOM_PRESETS.map((p) => (
          <button key={p.id} type="button" className="card room-card" onClick={() => startRoom(p.id)} title={p.description}>
            <span className="card-thumb room-thumb">
              <Mini preset={p} />
            </span>
            <span className="card-name">{p.name}</span>
            <small className="fine">
              {formatLength(p.w, units)} × {formatLength(p.d, units)}
            </small>
          </button>
        ))}
      </div>
    </aside>
  );
}
