import type { Balcony } from '@hd/scene-schema';
import { updateBalconies } from '@hd/editor-core';
import { editor } from '../plan/session';
import { materialsFor } from '../view3d/placeholderMaterials';
import { RAIL_COLORS } from '../view3d/railing';
import { RailingPanel } from './RailingPanel';
import { ColorSwatches, LengthField, Segmented, Swatches } from './fields';

const common = <T,>(vals: readonly T[]): T | null => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0]! : null);

const EDGE_COLORS = [
  { id: '#cfcac0', name: 'Concrete' },
  { id: '#e8e4da', name: 'Plaster' },
  { id: '#f1eee8', name: 'White' },
  { id: '#b9b4aa', name: 'Light grey' },
  { id: '#6c7378', name: 'Slate' },
  { id: '#3b3a38', name: 'Charcoal' },
  { id: '#7a5a3c', name: 'Brown' },
  { id: '#8a3b2e', name: 'Brick red' },
];

/** The balcony designer: floor, slab edge, railing (the same choices as stairs), supports underneath and a cover above. */
export function BalconyPanel({ balconies }: { balconies: Balcony[] }) {
  const ids = balconies.map((b) => b.id);
  const edit = (props: Parameters<typeof updateBalconies>[1]) => editor.execute(updateBalconies(ids, props));
  const railed = balconies.some((b) => b.railing !== 'none');
  const supports = common(balconies.map((b) => b.supports?.kind ?? 'none'));
  const canopy = common(balconies.map((b) => b.canopy?.kind ?? 'none'));
  return (
    <>
      <Swatches label="Floor" items={materialsFor('floor')} value={common(balconies.map((b) => b.floorMaterial.id))} onPick={(id) => edit({ floorMaterial: { id } })} />

      <Segmented
        label="Railing"
        value={common(balconies.map((b) => b.railing))}
        options={[
          { id: 'glass', label: 'Glass' },
          { id: 'metal', label: 'Metal' },
          { id: 'wood', label: 'Wood' },
          { id: 'wall', label: 'Wall' },
          { id: 'none', label: 'None' },
        ]}
        onChange={(railing) => edit({ railing })}
      />
      {railed && (
        <RailingPanel
          rails={balconies.map((b) => ({ railing: b.railing, opts: b.railingOpts }))}
          spacing
          onEdit={(railingOpts) => edit({ railingOpts })}
          onReset={() => edit({ railingOpts: null })}
        />
      )}

      <LengthField label="Slab thickness" value={common(balconies.map((b) => b.slab?.thickness ?? 0.15)) ?? 0.15} min={0.08} max={0.6} step={0.01} onCommit={(thickness) => edit({ slab: { thickness } })} />
      <ColorSwatches label="Slab edge colour" items={EDGE_COLORS} value={common(balconies.map((b) => b.slab?.edgeColor ?? '#cfcac0'))} onPick={(edgeColor) => edit({ slab: { edgeColor } })} />
      <LengthField label="Raised lip" hint="A low kerb round the open edges" value={common(balconies.map((b) => b.slab?.lip ?? 0)) ?? 0} min={0} max={0.15} step={0.01} onCommit={(lip) => edit({ slab: { lip } })} />

      <Segmented
        label="Supports"
        value={supports ?? ''}
        options={[
          { id: 'none', label: 'None' },
          { id: 'columns', label: 'Columns' },
          { id: 'brackets', label: 'Brackets' },
          { id: 'wall', label: 'Wall below' },
        ]}
        onChange={(v) => edit({ supports: { kind: v as NonNullable<NonNullable<Balcony['supports']>['kind']> } })}
      />
      {supports !== 'none' && supports !== null && (
        <>
          <LengthField label={supports === 'brackets' ? 'Bracket depth' : 'Support size'} value={common(balconies.map((b) => b.supports?.size ?? (b.supports?.kind === 'brackets' ? 0.4 : 0.2))) ?? 0.2} min={0.05} max={0.6} step={0.01} onCommit={(size) => edit({ supports: { size } })} />
          <ColorSwatches label="Support colour" items={[...EDGE_COLORS, ...RAIL_COLORS.filter((c) => c.id === '#2b2b2b')]} value={common(balconies.map((b) => b.supports?.color ?? '#cfcac0'))} onPick={(color) => edit({ supports: { color } })} />
        </>
      )}

      <Segmented
        label="Cover above"
        value={canopy ?? ''}
        options={[
          { id: 'none', label: 'None' },
          { id: 'flat', label: 'Flat roof' },
          { id: 'pergola', label: 'Pergola' },
        ]}
        onChange={(v) => edit({ canopy: { kind: v as NonNullable<NonNullable<Balcony['canopy']>['kind']> } })}
      />
      {canopy !== 'none' && canopy !== null && (
        <>
          <LengthField label="Cover height" hint="Underside above the floor" value={common(balconies.map((b) => b.canopy?.height ?? 2.7)) ?? 2.7} min={2} max={4} step={0.05} onCommit={(height) => edit({ canopy: { height } })} />
          <ColorSwatches label="Cover colour" items={[...EDGE_COLORS, ...RAIL_COLORS.filter((c) => ['#2b2b2b', '#8a5a3c', '#5a3a26'].includes(c.id))]} value={common(balconies.map((b) => b.canopy?.color ?? (b.canopy?.kind === 'pergola' ? '#8a5a3c' : '#e8e4da')))} onPick={(color) => edit({ canopy: { color } })} />
        </>
      )}

      <button type="button" className="pill small" title="Back to the plain look" onClick={() => edit({ railingOpts: null, slab: null, supports: null, canopy: null })}>
        Reset balcony options
      </button>
      <p className="f-note">The railing stays off the side that touches your house wall. Add a door in that wall to step out.</p>
    </>
  );
}
