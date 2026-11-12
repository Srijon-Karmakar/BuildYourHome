import type { Stair } from '@hd/scene-schema';
import { updateStairs } from '@hd/editor-core';
import { editor } from '../plan/session';
import { RAIL_COLORS } from '../view3d/railing';
import { ColorSwatches, LengthField, Segmented, Toggle } from './fields';

const common = <T,>(vals: readonly T[]): T | null => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0]! : null);

const BUILDS = [
  { id: 'solid', label: 'Solid' },
  { id: 'stringer', label: 'Side beams' },
  { id: 'spine', label: 'Centre spine' },
  { id: 'floating', label: 'Floating' },
] as const;

const FRAME_COLORS = [{ id: '#2b2b2b', name: 'Black' }, { id: '#6c7378', name: 'Steel' }, { id: '#f1eee8', name: 'White' }, ...RAIL_COLORS.filter((c) => !['#2b2b2b', '#f1eee8'].includes(c.id))];

/** How the flight is built: solid blocks, open treads on beams, on a spine, or floating; plus tread, riser and beam choices. */
export function StairBuildPanel({ stairs }: { stairs: Stair[] }) {
  const ids = stairs.map((s) => s.id);
  const build = common(stairs.map((s) => s.build ?? 'solid'));
  const open = stairs.some((s) => (s.build ?? 'solid') !== 'solid');
  const beams = stairs.some((s) => s.build === 'stringer' || s.build === 'spine');
  const allSpiral = stairs.every((s) => s.kind === 'spiral');
  const edit = (props: Parameters<typeof updateStairs>[1]) => editor.execute(updateStairs(ids, props));
  const steps = (p: NonNullable<Stair['steps']>) => edit({ steps: p });
  const beam = (p: NonNullable<Stair['stringer']>) => edit({ stringer: p });
  return (
    <>
      <Segmented label="Build" value={build ?? ''} options={BUILDS.map((b) => ({ id: b.id as string, label: b.label }))} onChange={(v) => edit({ build: v as NonNullable<Stair['build']> })} />
      {open && (
        <>
          <LengthField label="Step thickness" hint="Open steps are slabs" value={common(stairs.map((s) => s.steps?.thickness ?? 0.05)) ?? 0.05} min={0.02} max={0.2} step={0.01} onCommit={(thickness) => steps({ thickness })} />
          <LengthField label="Overhang" hint="Step over the one below" value={common(stairs.map((s) => s.steps?.nosing ?? 0.03)) ?? 0.03} min={0} max={0.08} step={0.01} onCommit={(nosing) => steps({ nosing })} />
          <Toggle label="Closed risers" hint="A plate between the steps" checked={stairs.every((s) => !!s.steps?.risers)} onChange={(risers) => steps({ risers })} />
          {stairs.some((s) => s.steps?.risers) && (
            <ColorSwatches label="Riser colour" items={FRAME_COLORS} value={common(stairs.map((s) => s.steps?.riserColor ?? s.stringer?.color ?? '#2b2b2b'))} onPick={(riserColor) => steps({ riserColor })} />
          )}
        </>
      )}
      {(beams || (open && allSpiral)) && (
        <>
          {!allSpiral && <LengthField label="Beam width" value={common(stairs.map((s) => s.stringer?.width ?? (s.build === 'spine' ? 0.12 : 0.06))) ?? 0.06} min={0.02} max={0.4} step={0.01} onCommit={(width) => beam({ width })} />}
          {!allSpiral && <LengthField label="Beam depth" value={common(stairs.map((s) => s.stringer?.depth ?? 0.22)) ?? 0.22} min={0.06} max={0.6} step={0.02} onCommit={(depth) => beam({ depth })} />}
          <ColorSwatches label={allSpiral ? 'Centre pole colour' : 'Beam colour'} items={FRAME_COLORS} value={common(stairs.map((s) => s.stringer?.color ?? '#2b2b2b'))} onPick={(color) => beam({ color })} />
        </>
      )}
      {open && (
        <button type="button" className="pill small" title="Back to the plain look of this build" onClick={() => edit({ steps: null, stringer: null })}>
          Reset step options
        </button>
      )}
    </>
  );
}
