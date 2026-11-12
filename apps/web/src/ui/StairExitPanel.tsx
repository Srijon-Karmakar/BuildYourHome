import type { Stair } from '@hd/scene-schema';
import { DEFAULT_EXIT_HEIGHT_M } from '@hd/geometry';
import { updateStairs } from '@hd/editor-core';
import { editor } from '../plan/session';
import { DEFAULT_EXIT_DOOR, DEFAULT_EXIT_FRAME, DEFAULT_EXIT_WALL, defaultExitFrame } from '../view3d/StairMesh';
import { ColorSwatches, LengthField, Segmented } from './fields';

type ExitChoice = 'none' | 'room' | 'glass' | 'hatch';

export const EXIT_OPTIONS: Array<{ id: ExitChoice; label: string }> = [
  { id: 'none', label: 'Open' },
  { id: 'room', label: 'Roof room' },
  { id: 'glass', label: 'Glass box' },
  { id: 'hatch', label: 'Hatch' },
];

const WALL_COLORS = [
  { id: DEFAULT_EXIT_WALL, name: 'Off-white' },
  { id: '#f4f1ea', name: 'White' },
  { id: '#e3c9a0', name: 'Sand' },
  { id: '#c98d6b', name: 'Terracotta' },
  { id: '#9fa7a6', name: 'Grey' },
  { id: '#b9c7a9', name: 'Sage' },
];
const FRAME_COLORS = [
  { id: DEFAULT_EXIT_FRAME, name: 'Black' },
  { id: '#6c7378', name: 'Steel' },
  { id: '#f1eee8', name: 'White' },
  { id: DEFAULT_EXIT_DOOR, name: 'Wood' },
];

const common = <T,>(vals: readonly T[]): T | null => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0]! : null);

/** What covers the top of the stairs where they come out: open, a roof room (chilekotha / mumty), a glass box or a hatch. */
export function StairExitPanel({ stairs }: { stairs: Stair[] }) {
  const ids = stairs.map((s) => s.id);
  const kind = common(stairs.map((s): ExitChoice => s.exit?.kind ?? 'none'));
  const edit = (exit: Parameters<typeof updateStairs>[1]['exit']) => editor.execute(updateStairs(ids, { exit }));
  const k = kind && kind !== 'none' ? kind : null;
  return (
    <>
      <Segmented label="Exit at the top" value={kind} options={EXIT_OPTIONS} onChange={(v) => edit(v === 'none' ? null : { kind: v })} />
      {k && (
        <>
          <LengthField
            label={k === 'hatch' ? 'Kerb height' : 'Height'}
            value={common(stairs.map((s) => s.exit?.height ?? DEFAULT_EXIT_HEIGHT_M[k]))}
            min={k === 'hatch' ? 0.15 : 1.9}
            max={k === 'hatch' ? 0.8 : 3.5}
            step={0.05}
            onCommit={(height) => edit({ height })}
          />
          {k !== 'glass' && (
            <ColorSwatches label={k === 'room' ? 'Wall colour' : 'Kerb colour'} items={WALL_COLORS} value={common(stairs.map((s) => s.exit?.color ?? DEFAULT_EXIT_WALL))} onPick={(color) => edit({ color })} />
          )}
          <ColorSwatches label={k === 'room' ? 'Door colour' : 'Frame colour'} items={FRAME_COLORS} value={common(stairs.map((s) => s.exit?.frame ?? defaultExitFrame(k)))} onPick={(frame) => edit({ frame })} />
        </>
      )}
    </>
  );
}
