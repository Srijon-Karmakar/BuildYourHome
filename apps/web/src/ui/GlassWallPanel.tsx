import type { Wall } from '@hd/scene-schema';
import { setWallsProps } from '@hd/editor-core';
import { editor } from '../plan/session';
import { DEFAULT_GLAZING_FRAME } from '../view3d/WallMesh';
import { ColorSwatches, LengthField, Segmented, Toggle } from './fields';

const common = <T,>(vals: readonly T[]): T | null => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0]! : null);

const FRAMES = [
  { id: 'slim', label: 'Slim' },
  { id: 'standard', label: 'Standard' },
  { id: 'bold', label: 'Bold' },
] as const;
const TINTS = [
  { id: 'clear', label: 'Clear' },
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'smoked', label: 'Smoked' },
  { id: 'frosted', label: 'Frosted' },
] as const;
const FRAME_COLORS = [
  { id: DEFAULT_GLAZING_FRAME, name: 'Black' },
  { id: '#6c7378', name: 'Aluminium' },
  { id: '#f1eee8', name: 'White' },
  { id: '#7a5236', name: 'Wood' },
  { id: '#a8865a', name: 'Bronze' },
];

/** Full glass wall: the whole wall as floor-to-ceiling glass panes in a frame. */
export function GlassWallPanel({ walls }: { walls: Wall[] }) {
  const ids = walls.map((w) => w.id);
  const on = walls.every((w) => !!w.glazed);
  const edit = (glazed: Parameters<typeof setWallsProps>[1]['glazed']) => editor.execute(setWallsProps(ids, { glazed }));
  return (
    <>
      <Toggle label="Full glass wall" hint="Floor-to-ceiling glass panes in a frame" checked={on} onChange={(v) => edit(v ? {} : null)} />
      {on && (
        <>
          <LengthField label="Pane width" value={common(walls.map((w) => w.glazed?.pane ?? 1.2))} min={0.4} max={3} step={0.05} onCommit={(pane) => edit({ pane })} />
          <Segmented label="Frame" value={common(walls.map((w) => w.glazed?.frame ?? 'standard'))} options={FRAMES.map((f) => ({ id: f.id as string, label: f.label }))} onChange={(frame) => edit({ frame: frame as 'slim' | 'standard' | 'bold' })} />
          <ColorSwatches label="Frame colour" items={FRAME_COLORS} value={common(walls.map((w) => w.glazed?.color ?? DEFAULT_GLAZING_FRAME))} onPick={(color) => edit({ color })} />
          <Segmented label="Glass" value={common(walls.map((w) => w.glazed?.tint ?? 'clear'))} options={TINTS.map((t) => ({ id: t.id as string, label: t.label }))} onChange={(tint) => edit({ tint: tint as NonNullable<NonNullable<Wall['glazed']>['tint']> })} />
          <LengthField label="Low wall under" hint="0 = glass to the floor" value={common(walls.map((w) => w.glazed?.sill ?? 0))} min={0} max={1.2} step={0.05} onCommit={(sill) => edit({ sill })} />
          <LengthField label="Cross bar at" hint="0 = none" value={common(walls.map((w) => w.glazed?.transom ?? 0))} min={0} max={3} step={0.05} onCommit={(transom) => edit({ transom })} />
        </>
      )}
    </>
  );
}
