import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { getAsset, itemFootprint } from '@hd/assets';
import type { Scene } from '@hd/scene-schema';
import { editor, useUi } from '../plan/session';
import { activePlan } from '../plan/PlanCanvas';
import { levelRooms } from '../plan/rooms';
import { SAMPLES, SAMPLE_GROUPS, type SampleGroup, type SampleInfo } from '../plan/samples';
import { formatArea } from '../lib/units';
import { useCloud } from '../cloud/store';

interface Built {
  info: SampleInfo;
  scene: Scene;
  beds: number;
  baths: number;
  area: number;
  floors: number;
}

const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

/** A small picture of the ground floor: plot and garden, rooms, walls and furniture. */
function Mini({ scene }: { scene: Scene }) {
  const lid = scene.levelOrder[0]!;
  const rooms = levelRooms(scene, lid);
  const walls = Object.values(scene.walls).filter((w) => w.levelId === lid);
  const pts: Array<[number, number]> = [];
  for (const w of walls) for (const id of [w.a, w.b]) {
    const n = scene.nodes[id];
    if (n) pts.push([n.p[0], n.p[1]]);
  }
  if (scene.plot) pts.push(...(scene.plot.boundary as Array<[number, number]>));
  for (const b of Object.values(scene.balconies)) if (b.levelId === lid) pts.push(...(b.outline as Array<[number, number]>));
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const pad = 0.6;
  const x0 = Math.min(...xs) - pad;
  const z0 = Math.min(...zs) - pad;
  const vw = Math.max(...xs) - x0 + pad;
  const vh = Math.max(...zs) - z0 + pad;
  const items = Object.values(scene.items).filter((i) => i.levelId === lid);
  const ink = '#2a2825';
  return (
    <svg className="sample-mini" viewBox={`${x0} ${z0} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {scene.plot && <polygon points={scene.plot.boundary.map((p) => p.join(',')).join(' ')} fill="#dfe6cf" stroke="#8a9a6a" strokeWidth={0.12} strokeDasharray="0.5 0.35" />}
      {Object.values(scene.zones).map((z) =>
        z.shape === 'area' ? <polygon key={z.id} points={z.points.map((p) => p.join(',')).join(' ')} fill="#c6d6a8" /> : <polyline key={z.id} points={z.points.map((p) => p.join(',')).join(' ')} fill="none" stroke="#c9c4b8" strokeWidth={z.width ?? 1} strokeLinejoin="round" />,
      )}
      {Object.values(scene.balconies).filter((b) => b.levelId === lid).map((b) => <polygon key={b.id} points={b.outline.map((p) => p.join(',')).join(' ')} fill="#efece5" stroke={ink} strokeWidth={0.06} />)}
      {rooms.map((r, i) => <polygon key={i} points={r.polygon.map((p) => p.join(',')).join(' ')} fill="#e7dfcd" />)}
      {items.map((it) => {
        const a = getAsset(it.assetId);
        if (!a || a.mount !== 'floor' || a.category === 'lighting') return null;
        const fp = itemFootprint(a, [it.position[0], it.position[2]], it.rotationY, it.scale);
        const outdoor = a.category === 'nature' || a.category === 'outdoor' || a.category === 'scenery';
        const tree = a.id.startsWith('tree-');
        return <polygon key={it.id} points={fp.map((p) => p.join(',')).join(' ')} fill={tree ? '#9bb77a' : outdoor ? '#ddd8cb' : '#fbfaf7'} stroke={tree ? '#6f8f52' : '#9a958a'} strokeWidth={0.04} />;
      })}
      {walls.map((w) => {
        const a = scene.nodes[w.a];
        const b = scene.nodes[w.b];
        return a && b ? <line key={w.id} x1={a.p[0]} y1={a.p[1]} x2={b.p[0]} y2={b.p[1]} stroke={w.kind === 'boundary' ? '#7a7468' : ink} strokeWidth={Math.max(w.thickness, 0.12)} strokeLinecap="square" /> : null;
      })}
      {Object.values(scene.openings).filter((o) => scene.walls[o.wallId]?.levelId === lid).map((o) => {
        const w = scene.walls[o.wallId]!;
        const a = scene.nodes[w.a]!.p;
        const b = scene.nodes[w.b]!.p;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const ux = (b[0] - a[0]) / len;
        const uz = (b[1] - a[1]) / len;
        const p = (s: number): [number, number] => [a[0] + ux * s, a[1] + uz * s];
        const s0 = p(o.offset - o.width / 2);
        const s1 = p(o.offset + o.width / 2);
        return <line key={o.id} x1={s0[0]} y1={s0[1]} x2={s1[0]} y2={s1[1]} stroke={o.type === 'window' ? '#7fa6c4' : '#e7dfcd'} strokeWidth={w.thickness * 0.8} />;
      })}
    </svg>
  );
}

/** A gallery of ready-made homes with a plan picture each: flats, houses, a villa, a shop and an office. */
export function SamplesGallery() {
  const open = useUi((s) => s.samplesOpen);
  const setOpen = useUi((s) => s.setSamplesOpen);
  const units = useStore(editor.store, (s) => s.scene.meta.units);
  const hasWalls = useStore(editor.store, (s) => Object.keys(s.scene.walls).length > 0);
  const welcome = useUi((s) => s.welcomeOpen);
  const [group, setGroup] = useState<SampleGroup | 'all'>('all');
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setArmed(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, setOpen]);

  const built = useMemo<Built[]>(() => {
    if (!open) return [];
    return SAMPLES.map((info) => {
      const scene = info.build();
      const rooms = Object.values(scene.rooms);
      const area = scene.levelOrder.reduce((n, lid) => n + levelRooms(scene, lid).reduce((m, r) => m + r.area, 0), 0);
      return { info, scene, beds: rooms.filter((r) => r.type === 'bedroom').length, baths: rooms.filter((r) => r.type === 'bathroom').length, area, floors: scene.levelOrder.length };
    });
  }, [open]);

  if (!open) return null;

  const pick = (b: Built) => {
    // Replacing a home that has walls takes a second tap (unless this is the welcome screen).
    if (hasWalls && !welcome && armed !== b.info.id) return setArmed(b.info.id);
    useCloud.getState().detach();
    editor.loadScene({ ...b.scene, meta: { ...b.scene.meta, units } });
    store('hd.welcomed', '1');
    const ui = useUi.getState();
    ui.setWelcomeOpen(false);
    ui.setSamplesOpen(false);
    ui.setTipsOn(true);
    window.setTimeout(() => {
      activePlan?.fitToPlan();
      useUi.getState().bumpFit();
    }, 50);
  };

  const shown = built.filter((b) => group === 'all' || b.info.group === group);
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="samples-title" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="welcome-card samples">
        <header>
          <h1 id="samples-title">Ready-made homes</h1>
          <button type="button" className="ins-close" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>
        <p className="welcome-sub">Pick one to start from. They come furnished; change anything afterwards.{hasWalls && !welcome ? ' Choosing one replaces the home you have open.' : ''}</p>
        <div className="sample-tabs" role="group" aria-label="Kind of home">
          {SAMPLE_GROUPS.map((g) => (
            <button key={g.id} type="button" className="pill small" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="sample-grid">
          {shown.map((b) => (
            <button key={b.info.id} type="button" className={`sample-card${armed === b.info.id ? ' armed' : ''}`} data-sample={b.info.id} onClick={() => pick(b)}>
              <span className="sample-thumb">
                <Mini scene={b.scene} />
                {b.floors > 1 && <em className="sample-badge">{b.floors} floors</em>}
              </span>
              <strong>{armed === b.info.id ? 'Tap again to replace your home' : b.info.name}</strong>
              <small className="fine">
                {b.beds > 0 ? `${b.beds} bed · ` : ''}
                {b.baths > 0 ? `${b.baths} bath · ` : ''}
                {formatArea(b.area, units)}
              </small>
              <small className="fine sample-blurb">{b.info.blurb}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
