import { useStore } from 'zustand';
import type { Roof } from '@hd/scene-schema';
import { matchRoofsOnFloor, resetRoofs, setAutoRoofs, updateRoofs } from '@hd/editor-core';
import { editor } from '../plan/session';
import { flatRoofEdge, orientedBox } from '@hd/geometry';
import { DEFAULT_GABLE, DEFAULT_TRIM, roofFootprint } from '../view3d/RoofMesh';
import { RailingPanel } from './RailingPanel';
import { materialsFor, paintMaterials } from '../view3d/placeholderMaterials';
import { AngleField, ColorSwatches, LengthField, Section, Segmented, Swatches, Toggle } from './fields';

const TRIM_COLORS = [
  { id: '#f1eee8', name: 'White' },
  { id: '#e0d6c2', name: 'Cream' },
  { id: '#b9b4aa', name: 'Light grey' },
  { id: '#6c7378', name: 'Slate' },
  { id: '#3b3a38', name: 'Charcoal' },
  { id: '#7a5a3c', name: 'Brown' },
  { id: '#8a3b2e', name: 'Brick red' },
  { id: '#2f5d7a', name: 'Blue' },
];

const STYLES = [
  { id: 'flat', label: 'Flat' },
  { id: 'shed', label: 'Shed' },
  { id: 'gable', label: 'Gable' },
  { id: 'hip', label: 'Hip' },
  { id: 'butterfly', label: 'Butterfly' },
  { id: 'mansard', label: 'Mansard' },
  { id: 'barrel', label: 'Barrel' },
] as const;

/** Compass names of the four sides of a flat roof, in the order the railing counts them (corner 0 → 1 → 2 → 3). */
function sideNames(roof: Roof, scene: Parameters<typeof roofFootprint>[0]): string[] {
  const level = scene.levels[roof.levelId];
  const box = roof.box ?? orientedBox(roofFootprint(scene, roof.levelId).points);
  if (!box || !level) return ['Side 1', 'Side 2', 'Side 3', 'Side 4'];
  const edge = flatRoofEdge(box, level.elevation + level.height, { style: 'flat', pitchDeg: 0, overhang: roof.overhang, swap: !!roof.ridgeAngle, rake: roof.rake }, 0.115);
  if (!edge) return ['Side 1', 'Side 2', 'Side 3', 'Side 4'];
  const cx = edge.corners.reduce((a, q) => a + q[0], 0) / 4;
  const cz = edge.corners.reduce((a, q) => a + q[1], 0) / 4;
  const names = edge.corners.map((a, i) => {
    const b = edge.corners[(i + 1) % 4]!;
    const dx = (a[0] + b[0]) / 2 - cx;
    const dz = (a[1] + b[1]) / 2 - cz;
    return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'East side' : 'West side') : dz < 0 ? 'North side' : 'South side';
  });
  // a roof turned 45 degrees can give two sides the same name
  return names.map((n, i) => (names.indexOf(n) !== i ? `${n} (2)` : n));
}

const common = <T,>(vals: readonly T[]): T | null => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0]! : null);

/** The roof designer: shape, slope, overhangs, edge, material, trim, gutters, chimney and the automatic / hand-made switch. */
export function RoofPanel({ roofs }: { roofs: Roof[] }) {
  const scene = useStore(editor.store, (s) => s.scene);
  const ids = roofs.map((r) => r.id);
  const edit = (props: Parameters<typeof updateRoofs>[1]) => editor.execute(updateRoofs(ids, props));
  const style = common(roofs.map((r) => r.style));
  const all = (f: (r: Roof) => boolean) => roofs.every(f);
  const some = (f: (r: Roof) => boolean) => roofs.some(f);
  const level = roofs.length > 0 && roofs.every((r) => r.levelId === roofs[0]!.levelId) ? roofs[0]!.levelId : null;
  const floorRoofs = level ? Object.values(scene.roofs).filter((r) => r.levelId === level).length : 0;
  const auto = level ? !!scene.levels[level]?.autoRoof : false;
  const pitched = some((r) => r.style !== 'flat' && r.style !== 'barrel');
  const plate = some((r) => r.style === 'gable' || r.style === 'hip' || r.style === 'flat' || r.style === 'shed');
  const ridge = some((r) => r.style === 'gable' || r.style === 'hip');
  const chimneyOk = some((r) => r.style === 'gable' || r.style === 'hip' || r.style === 'flat' || r.style === 'shed');
  const turnable = some((r) => r.style === 'gable' || r.style === 'hip' || r.style === 'butterfly' || r.style === 'barrel');
  const mixedFloor = roofs.some((r) => !r.box);
  const dormerOk = roofs.length === 1 && (roofs[0]!.style === 'gable' || roofs[0]!.style === 'hip');
  const dormers = roofs.length === 1 ? (roofs[0]!.dormers ?? []) : [];
  const setDormers = (list: NonNullable<Roof['dormers']>) => edit({ dormers: list });

  return (
    <Section title={roofs.length > 1 ? `Roofs (${roofs.length})` : 'Roof'}>
      {level && (
        <p className="f-note" role="note">
          {mixedFloor ? 'One roof over the whole floor.' : auto ? 'Automatic: this floor’s roofs follow its rooms.' : 'Hand-made: these roofs stay where they are.'}
        </p>
      )}
      <Segmented label="Shape" value={style ?? ''} options={STYLES.map((s) => ({ id: s.id as string, label: s.label }))} onChange={(v) => edit({ style: v as Roof['style'] })} />
      {pitched && <AngleField label="Slope" value={common(roofs.map((r) => r.pitchDeg)) ?? roofs[0]!.pitchDeg} onCommit={(pitchDeg) => edit({ pitchDeg })} />}
      <LengthField label="Overhang" hint="Past the walls at the eaves" value={common(roofs.map((r) => r.overhang)) ?? roofs[0]!.overhang} min={0} max={1.5} step={0.05} onCommit={(overhang) => edit({ overhang })} />
      {(style === 'gable' || style === 'hip' || style === 'shed') && (
        <LengthField label="Gable end overhang" hint="Past the walls at the ends" value={common(roofs.map((r) => r.rake ?? r.overhang)) ?? roofs[0]!.overhang} min={0} max={1.5} step={0.05} onCommit={(rake) => edit({ rake })} />
      )}
      {plate && <LengthField label="Edge thickness" value={common(roofs.map((r) => r.thickness ?? (r.style === 'flat' ? 0.18 : 0.12))) ?? 0.12} min={0.05} max={0.4} step={0.01} onCommit={(thickness) => edit({ thickness })} />}
      {style === 'flat' && <LengthField label="Parapet" hint="Low wall round the edge" value={common(roofs.map((r) => r.parapet ?? 0)) ?? 0} min={0} max={0.9} step={0.05} onCommit={(parapet) => edit({ parapet })} />}
      {style === 'flat' && (
        <>
          <Segmented
            label="Terrace railing"
            value={common(roofs.map((r) => r.railing ?? 'none'))}
            options={[
              { id: 'none', label: 'None' },
              { id: 'wood', label: 'Wood' },
              { id: 'metal', label: 'Metal' },
              { id: 'glass', label: 'Glass' },
            ]}
            onChange={(railing) => edit({ railing: railing as NonNullable<Roof['railing']> })}
          />
          {some((r) => !!r.railing && r.railing !== 'none') && (
            <RailingPanel
              rails={roofs.filter((r) => r.railing && r.railing !== 'none').map((r) => ({ railing: r.railing, opts: r.railingOpts }))}
              spacing
              inset
              edges={roofs.length === 1 ? sideNames(roofs[0]!, scene) : undefined}
              onEdit={(railingOpts) => edit({ railingOpts })}
              onReset={() => edit({ railingOpts: null })}
            />
          )}
        </>
      )}
      <Swatches label="Roof material" items={materialsFor('roof')} value={common(roofs.map((r) => r.material.id))} onPick={(materialId) => edit({ materialId })} />
      {plate && <ColorSwatches label="Trim colour" items={TRIM_COLORS} value={common(roofs.map((r) => r.trim ?? DEFAULT_TRIM))} onPick={(trim) => edit({ trim })} />}
      {(style === 'gable' || style === 'shed' || style === 'barrel' || style === 'flat') && (
        <Swatches label={style === 'flat' ? 'Parapet wall' : 'Gable wall'} items={paintMaterials()} value={common(roofs.map((r) => r.gable?.id ?? DEFAULT_GABLE))} onPick={(gableMaterialId) => edit({ gableMaterialId })} />
      )}
      {ridge && <Toggle label="Ridge cap" checked={all((r) => r.ridgeCap !== false)} onChange={(ridgeCap) => edit({ ridgeCap })} />}
      {plate && <Toggle label="Gutters" checked={all((r) => !!r.gutter)} onChange={(gutter) => edit({ gutter })} />}
      {chimneyOk && <Toggle label="Chimney" checked={all((r) => !!r.chimney)} onChange={(chimney) => edit({ chimney })} />}
      {dormerOk && (
        <div className="f-group" role="group" aria-label="Dormers">
          <div className="f-label">
            Dormer windows
            <small>{dormers.length === 0 ? 'None' : `${dormers.length}`}</small>
          </div>
          {dormers.map((d, i) => (
            <div key={i} className="dormer-row">
              <button type="button" className="pill small" title="Which slope" onClick={() => setDormers(dormers.map((x, k) => (k === i ? { ...x, side: (x.side === 1 ? -1 : 1) as 1 | -1 } : x)))}>
                {d.side === 1 ? 'Front' : 'Back'}
              </button>
              <input type="range" min={-1} max={1} step={0.05} value={d.pos} aria-label={`Dormer ${i + 1} position`} onChange={(e) => setDormers(dormers.map((x, k) => (k === i ? { ...x, pos: Number(e.target.value) } : x)))} />
              <button type="button" className="pill small" aria-label={`Wider dormer ${i + 1}`} title="Wider" onClick={() => setDormers(dormers.map((x, k) => (k === i ? { ...x, width: Math.min(3, x.width + 0.2) } : x)))}>
                +
              </button>
              <button type="button" className="pill small" aria-label={`Narrower dormer ${i + 1}`} title="Narrower" onClick={() => setDormers(dormers.map((x, k) => (k === i ? { ...x, width: Math.max(0.6, x.width - 0.2) } : x)))}>
                −
              </button>
              <button type="button" className="pill small" aria-label={`Remove dormer ${i + 1}`} onClick={() => setDormers(dormers.filter((_, k) => k !== i))}>
                ×
              </button>
            </div>
          ))}
          {dormers.length > 0 && roofs[0]!.pitchDeg < 30 && <small className="fine">A steeper roof (30° or more) gives the dormers room to show.</small>}
          {dormers.length < 6 && (
            <button type="button" className="pill small" onClick={() => setDormers([...dormers, { pos: dormers.length % 2 ? 0.5 : -0.5, side: (dormers.length % 4 < 2 ? 1 : -1) as 1 | -1, width: 1.2 }])}>
              + Add a dormer
            </button>
          )}
        </div>
      )}
      {turnable && (
        <button type="button" className="pill small" onClick={() => edit({ swap: !all((r) => !!r.ridgeAngle) })}>
          Turn the roof 90°
        </button>
      )}
      {level && (
        <div className="fa-row">
          {roofs.length === 1 && floorRoofs > 1 && (
            <button type="button" className="pill small" title="Give every roof of this floor the same shape, slope, material and trim" onClick={() => editor.execute(matchRoofsOnFloor(roofs[0]!.id))}>
              Same on this whole floor
            </button>
          )}
          <button type="button" className="pill small" aria-pressed={auto && !mixedFloor} title={auto && !mixedFloor ? 'Roofs follow the rooms. Tap to freeze them where they are' : 'Let the roofs follow the rooms again'} onClick={() => editor.execute(setAutoRoofs(level, !(auto && !mixedFloor)))}>
            {auto && !mixedFloor ? 'Automatic' : 'Make automatic'}
          </button>
          <button type="button" className="pill small" title="Start the roofs of this floor again from its rooms" onClick={() => editor.execute(resetRoofs(level))}>
            Rebuild roofs
          </button>
        </div>
      )}
    </Section>
  );
}
