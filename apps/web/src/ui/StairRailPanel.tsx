import type { Stair } from '@hd/scene-schema';
import { updateStairs } from '@hd/editor-core';
import { editor } from '../plan/session';
import { GLASS_TINTS, RAIL_COLORS, railColor, railOptions } from '../view3d/railing';
import { ColorSwatches, LengthField, Segmented } from './fields';

const common = <T,>(vals: readonly T[]): T | null => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0]! : null);

const GAPS = [
  { id: 'close', label: 'Close', value: 0.08 },
  { id: 'normal', label: 'Normal', value: 0.12 },
  { id: 'wide', label: 'Wide', value: 0.2 },
];
const POSTS = [
  { id: 'slim', label: 'Slim', value: 0.03 },
  { id: 'standard', label: 'Standard', value: 0.045 },
  { id: 'chunky', label: 'Chunky', value: 0.08 },
];
const nearest = <T extends { value: number }>(list: readonly T[], v: number): T => list.reduce((best, x) => (Math.abs(x.value - v) < Math.abs(best.value - v) ? x : best), list[0]!);

/** More railing choices: how it is filled, colour, handrail, height, spacing, posts, which side and the glass tint. */
export function StairRailPanel({ stairs }: { stairs: Stair[] }) {
  const ids = stairs.map((s) => s.id);
  const edit = (railingOpts: NonNullable<Parameters<typeof updateStairs>[1]['railingOpts']>) => editor.execute(updateStairs(ids, { railingOpts }));
  const opts = stairs.map((s) => railOptions(s));
  const infill = common(opts.map((o) => o.infill));
  const fills = infill === 'balusters' || infill === 'cables';
  const spiral = stairs.every((s) => s.kind === 'spiral');
  const glass = stairs.some((s) => railOptions(s).infill === 'glass');
  return (
    <>
      <Segmented
        label="Railing style"
        value={infill ?? ''}
        options={[
          { id: 'balusters', label: 'Balusters' },
          { id: 'cables', label: 'Cables' },
          { id: 'glass', label: 'Glass' },
          { id: 'solid', label: 'Solid' },
          { id: 'none', label: 'Open' },
        ]}
        onChange={(v) => edit({ infill: v as NonNullable<Stair['railingOpts']>['infill'] })}
      />
      <ColorSwatches label="Railing colour" items={RAIL_COLORS} value={common(stairs.map((s) => railColor(s)))} onPick={(color) => edit({ color })} />
      <Segmented
        label="Handrail"
        value={common(opts.map((o) => o.handrail)) ?? ''}
        options={[
          { id: 'round', label: 'Round' },
          { id: 'flat', label: 'Flat' },
          { id: 'wide', label: 'Wide' },
        ]}
        onChange={(v) => edit({ handrail: v as 'round' | 'flat' | 'wide' })}
      />
      <LengthField label="Railing height" value={common(opts.map((o) => o.height)) ?? opts[0]!.height} min={0.6} max={1.3} step={0.05} onCommit={(height) => edit({ height })} />
      {fills && (
        <Segmented
          label={infill === 'cables' ? 'Cable spacing' : 'Baluster spacing'}
          value={common(opts.map((o) => nearest(GAPS, o.gap).id)) ?? ''}
          options={GAPS.map((g) => ({ id: g.id, label: g.label }))}
          onChange={(id) => edit({ gap: GAPS.find((g) => g.id === id)!.value })}
        />
      )}
      <Segmented
        label="Posts"
        value={common(opts.map((o) => nearest(POSTS, o.post).id)) ?? ''}
        options={POSTS.map((p) => ({ id: p.id, label: p.label }))}
        onChange={(id) => edit({ post: POSTS.find((p) => p.id === id)!.value })}
      />
      {!spiral && (
        <Segmented
          label="Rail on"
          value={common(opts.map((o) => o.sides)) ?? ''}
          options={[
            { id: 'both', label: 'Both sides' },
            { id: 'left', label: 'Left only' },
            { id: 'right', label: 'Right only' },
          ]}
          onChange={(v) => edit({ sides: v as 'both' | 'left' | 'right' })}
        />
      )}
      {glass && (
        <Segmented
          label="Glass"
          value={common(stairs.map((s) => s.railingOpts?.tint ?? 'clear')) ?? ''}
          options={(Object.keys(GLASS_TINTS) as Array<keyof typeof GLASS_TINTS>).map((k) => ({ id: k as string, label: GLASS_TINTS[k].name }))}
          onChange={(v) => edit({ tint: v as keyof typeof GLASS_TINTS })}
        />
      )}
      <button
        type="button"
        className="pill small"
        title="Back to the plain look of the chosen railing"
        onClick={() => editor.execute(updateStairs(ids, { railingOpts: null }))}
      >
        Reset railing options
      </button>
    </>
  );
}
