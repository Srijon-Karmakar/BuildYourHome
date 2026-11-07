import { useState } from 'react';
import { useStore } from 'zustand';
import type { RoadExtra, RoadStyle, Zone } from '@hd/scene-schema';
import { clearStreet, fillStreet, getStreetStyle, ROAD_PRESETS, roadStyleFor, STREET_STYLES, streetItemCount, updateZones, type RoadPresetId } from '@hd/editor-core';
import { editor } from '../plan/session';
import { materialsFor } from '../view3d/placeholderMaterials';
import { LengthField, Section, Segmented, Swatches, Toggle } from './fields';

const common = <T,>(vals: readonly T[]): T | null => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0]! : null);

const SURFACES = ['ground-asphalt', 'ground-concrete', 'ground-cobble', 'ground-red-earth', 'ground-brick-paving', 'ground-soil', 'ground-gravel', 'ground-asphalt-light'];
const PAVEMENTS = ['ground-paving', 'ground-stone', 'ground-brick-paving', 'ground-concrete', 'ground-cobble', 'ground-flagstone', 'ground-garden-tiles', 'ground-white-gravel', 'ground-gravel', 'ground-play'];

const KERBS = [
  { id: 'flush', label: 'Flush', value: 0 },
  { id: 'low', label: 'Low', value: 0.08 },
  { id: 'standard', label: 'Standard', value: 0.12 },
  { id: 'high', label: 'High', value: 0.18 },
];
const nearestKerb = (v: number) => KERBS.reduce((b, k) => (Math.abs(k.value - v) < Math.abs(b.value - v) ? k : b), KERBS[2]!);

const EXTRAS: Array<{ kind: RoadExtra['kind']; label: string; spacing: number; side: RoadExtra['side'] }> = [
  { kind: 'light', label: 'Street lights', spacing: 24, side: 'both' },
  { kind: 'tree', label: 'Trees', spacing: 10, side: 'alternate' },
  { kind: 'bench', label: 'Benches', spacing: 30, side: 'alternate' },
  { kind: 'bin', label: 'Dustbins', spacing: 36, side: 'alternate' },
  { kind: 'bollard', label: 'Bollard lights', spacing: 8, side: 'both' },
];
const TREES = [
  { id: 'tree-neem', label: 'Neem' },
  { id: 'tree-gulmohar', label: 'Gulmohar' },
  { id: 'tree-mango', label: 'Mango' },
  { id: 'tree-round', label: 'Shade' },
  { id: 'tree-palm', label: 'Palm' },
  { id: 'tree-cypress', label: 'Cypress' },
];

/** Position of a crossing or bump along the road as a slider (0 = the start you drew from, 1 = the end). */
function Marks({ title, list, onChange, add }: { title: string; list: readonly number[]; onChange: (v: number[]) => void; add: string }) {
  return (
    <div className="f-group" role="group" aria-label={title}>
      <div className="f-label">
        {title}
        <small>{list.length === 0 ? 'None' : list.length}</small>
      </div>
      {list.map((t, i) => (
        <div key={i} className="dormer-row">
          <input type="range" min={0} max={1} step={0.01} value={t} aria-label={`${title} ${i + 1} position`} onChange={(e) => onChange(list.map((v, k) => (k === i ? Number(e.target.value) : v)))} />
          <button type="button" className="pill small" aria-label={`Remove ${title} ${i + 1}`} onClick={() => onChange(list.filter((_, k) => k !== i))}>
            ×
          </button>
        </div>
      ))}
      {list.length < 8 && (
        <button type="button" className="pill small" onClick={() => onChange([...list, list.length === 0 ? 0.5 : Math.min(1, (list[list.length - 1] ?? 0.5) + 0.12)])}>
          + {add}
        </button>
      )}
    </div>
  );
}

/** Houses, shops and trees along both sides of a road, with people, animals and vehicles in the street. */
function Neighbours({ road }: { road: Zone }) {
  const [style, setStyle] = useState('suburb');
  const [trees, setTrees] = useState(true);
  const [life, setLife] = useState(true);
  const count = useStore(editor.store, (st) => streetItemCount(st.scene, road.id));
  const fill = () => editor.execute(fillStreet(road.id, style, 1 + Math.floor(Math.random() * 100000), { trees, life }));
  return (
    <div className="road-extra" role="group" aria-label="Neighbours">
      <div className="f-label" style={{ marginTop: 6 }}>
        Neighbours along this road
        <small>{count === 0 ? 'None' : `${count} placed`}</small>
      </div>
      <Segmented label="Street style" value={style} options={STREET_STYLES.map((x) => ({ id: x.id, label: x.name }))} onChange={setStyle} />
      <p className="f-note">{getStreetStyle(style)?.description}</p>
      <Toggle label="Trees in the gardens" checked={trees} onChange={setTrees} />
      <Toggle label="People, animals and vehicles" checked={life} onChange={setLife} />
      <div className="road-actions">
        <button type="button" className="pill small" onClick={fill}>
          {count === 0 ? 'Fill both sides' : 'Fill again'}
        </button>
        {count > 0 && (
          <button type="button" className="pill small" onClick={() => editor.execute(clearStreet(road.id))}>
            Clear neighbours
          </button>
        )}
      </div>
    </div>
  );
}

/** The road editor: width, lanes, surface, paint, kerb, pavements, crossings and bumps, and what stands along it. */
export function RoadPanel({ roads }: { roads: Zone[] }) {
  const ids = roads.map((r) => r.id);
  const styles = roads.map((r) => r.road!);
  const edit = (road: Partial<RoadStyle>) => editor.execute(updateZones(ids, { road }));
  const one = roads.length === 1 ? roads[0]! : null;
  const oneWay = styles.every((s) => s.oneWay);
  const extras = one?.road?.extras ?? [];
  const setExtra = (kind: RoadExtra['kind'], patch: Partial<RoadExtra> | null) => {
    if (!one) return;
    const rest = extras.filter((e) => e.kind !== kind);
    if (patch === null) return edit({ extras: rest });
    const base = extras.find((e) => e.kind === kind) ?? { ...EXTRAS.find((x) => x.kind === kind)!, kind };
    const { label: _label, ...clean } = base as RoadExtra & { label?: string };
    void _label;
    edit({ extras: [...rest, { ...clean, ...patch, ...(kind === 'tree' && !(patch.asset ?? clean.asset) ? { asset: 'tree-neem' } : {}) } as RoadExtra] });
  };
  const apply = (id: RoadPresetId) => {
    const p = roadStyleFor(id, styles[0]!.pavMaterial);
    // Keep the lights / trees the person added; the preset sets the width, lanes, markings, kerb and pavements.
    editor.execute(updateZones(ids, { width: p.width, road: { ...p.style, extras: one?.road?.extras ?? p.style.extras, crossings: one?.road?.crossings ?? [], bumps: one?.road?.bumps ?? [] } }));
  };
  return (
    <Section title={roads.length > 1 ? `Roads (${roads.length})` : 'Road'}>
      <Segmented label="Start from" value="" options={ROAD_PRESETS.map((p) => ({ id: p.id as string, label: p.label }))} onChange={(id) => apply(id as RoadPresetId)} />
      <LengthField label="Width" hint="The road surface, kerb to kerb" value={common(roads.map((r) => r.width ?? 6))} min={2.5} max={24} step={0.5} onCommit={(width) => editor.execute(updateZones(ids, { width }))} />
      <Segmented
        label="Lanes"
        value={common(styles.map((s) => String(s.lanes))) ?? ''}
        options={['1', '2', '3', '4', '6'].map((n) => ({ id: n, label: n }))}
        onChange={(n) => edit({ lanes: Number(n) })}
      />
      <Toggle label="One way" checked={oneWay} onChange={(v) => edit({ oneWay: v })} />
      <Swatches label="Road surface" items={materialsFor('ground').filter((m) => SURFACES.includes(m.id))} value={common(roads.map((r) => r.material.id))} onPick={(id) => editor.execute(updateZones(ids, { material: { id } }))} />
      <Segmented
        label="Centre line"
        value={oneWay ? 'none' : (common(styles.map((s) => s.centre)) ?? '')}
        options={[
          { id: 'none', label: 'None' },
          { id: 'dashed', label: 'Dashed' },
          { id: 'solid', label: 'Solid' },
          { id: 'double', label: 'Double' },
        ]}
        onChange={(c) => edit({ centre: c as RoadStyle['centre'] })}
      />
      <Toggle label="Edge lines" checked={styles.every((s) => s.edges)} onChange={(edges) => edit({ edges })} />
      <Segmented
        label="Parking bays"
        value={common(styles.map((s) => s.parking)) ?? ''}
        options={[
          { id: 'none', label: 'None' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'both', label: 'Both' },
        ]}
        onChange={(parking) => edit({ parking: parking as RoadStyle['parking'] })}
      />
      <Segmented label="Kerb" value={common(styles.map((s) => nearestKerb(s.kerb).id)) ?? ''} options={KERBS.map((k) => ({ id: k.id, label: k.label }))} onChange={(id) => edit({ kerb: KERBS.find((k) => k.id === id)!.value })} />
      <LengthField label="Left pavement" hint="Left of the way you drew it. 0 = none" value={common(styles.map((s) => s.pavLeft))} min={0} max={6} step={0.1} onCommit={(pavLeft) => edit({ pavLeft })} />
      <LengthField label="Right pavement" value={common(styles.map((s) => s.pavRight))} min={0} max={6} step={0.1} onCommit={(pavRight) => edit({ pavRight })} />
      <Swatches label="Pavement material" items={materialsFor('ground').filter((m) => PAVEMENTS.includes(m.id))} value={common(styles.map((s) => s.pavMaterial.id))} onPick={(id) => edit({ pavMaterial: { id } })} />
      {one && (
        <>
          <Marks title="Zebra crossings" list={one.road!.crossings} onChange={(crossings) => edit({ crossings })} add="Add a zebra crossing" />
          <Marks title="Speed bumps" list={one.road!.bumps} onChange={(bumps) => edit({ bumps })} add="Add a speed bump" />
          <div className="f-label" style={{ marginTop: 6 }}>
            Along the road
          </div>
          {EXTRAS.map((x) => {
            const cur = extras.find((e) => e.kind === x.kind);
            return (
              <div key={x.kind} className="road-extra">
                <Toggle label={x.label} checked={!!cur} onChange={(on) => setExtra(x.kind, on ? {} : null)} />
                {cur && (
                  <>
                    <Segmented
                      label="Side"
                      value={cur.side}
                      options={[
                        { id: 'both', label: 'Both' },
                        { id: 'left', label: 'Left' },
                        { id: 'right', label: 'Right' },
                        { id: 'alternate', label: 'Alternate' },
                      ]}
                      onChange={(side) => setExtra(x.kind, { side: side as RoadExtra['side'] })}
                    />
                    <LengthField label="Every" hint="Distance between them" value={cur.spacing} min={3} max={80} step={1} onCommit={(spacing) => setExtra(x.kind, { spacing })} />
                    {x.kind === 'tree' && <Segmented label="Tree" value={cur.asset ?? 'tree-neem'} options={TREES.map((t) => ({ id: t.id, label: t.label }))} onChange={(asset) => setExtra('tree', { asset })} />}
                  </>
                )}
              </div>
            );
          })}
          <Neighbours road={one} />
        </>
      )}
    </Section>
  );
}
