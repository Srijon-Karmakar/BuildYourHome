import type { RailingOpts } from '@hd/scene-schema';
import { GLASS_TINTS, RAIL_COLORS, railColorFor, railOptionsFor, type RailingKindName } from '../view3d/railing';
import { ColorSwatches, LengthField, Segmented, Toggle } from './fields';

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
const SPACINGS = [
  { id: 'close', label: 'Close', value: 0.8 },
  { id: 'normal', label: 'Normal', value: 1.2 },
  { id: 'wide', label: 'Wide', value: 2 },
];
const nearest = <T extends { value: number }>(list: readonly T[], v: number): T => list.reduce((best, x) => (Math.abs(x.value - v) < Math.abs(best.value - v) ? x : best), list[0]!);

export interface RailingPanelProps {
  /** One entry per selected thing that has this railing. */
  rails: Array<{ railing: RailingKindName; opts: RailingOpts | undefined }>;
  onEdit: (opts: Partial<RailingOpts>) => void;
  onReset: () => void;
  /** Stairs: which side of the flight gets a rail. */
  sides?: boolean;
  /** Balconies and roofs: how far apart the posts stand. */
  spacing?: boolean;
  /** Roofs: how far the railing stands in from the edge, and which sides are left open (labels in order of the sides). */
  inset?: boolean;
  edges?: string[];
  /** Hide the wall thickness etc. for kinds that do not use them. */
  wall?: boolean;
}

/** Railing choices shared by stairs, balconies and roof terraces: filling, colour, handrail, height, spacing, posts, glass tint. */
export function RailingPanel({ rails, onEdit, onReset, sides, spacing, inset, edges, wall }: RailingPanelProps) {
  const opts = rails.map((r) => railOptionsFor(r.railing, r.opts));
  const infill = common(opts.map((o) => o.infill));
  const fills = infill === 'balusters' || infill === 'cables';
  const glass = opts.some((o) => o.infill === 'glass');
  const solid = opts.some((o) => o.infill === 'solid');
  const skip = common(rails.map((r) => JSON.stringify(r.opts?.skip ?? [])));
  const skipped: number[] = skip ? (JSON.parse(skip) as number[]) : [];
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
        onChange={(v) => onEdit({ infill: v as NonNullable<RailingOpts['infill']> })}
      />
      <ColorSwatches label="Railing colour" items={RAIL_COLORS} value={common(rails.map((r) => railColorFor(r.railing, r.opts)))} onPick={(color) => onEdit({ color })} />
      <Segmented
        label="Handrail"
        value={common(opts.map((o) => o.handrail)) ?? ''}
        options={[
          { id: 'round', label: 'Round' },
          { id: 'flat', label: 'Flat' },
          { id: 'wide', label: 'Wide' },
        ]}
        onChange={(v) => onEdit({ handrail: v as 'round' | 'flat' | 'wide' })}
      />
      <LengthField label="Railing height" value={common(opts.map((o) => o.height)) ?? opts[0]!.height} min={0.6} max={1.3} step={0.05} onCommit={(height) => onEdit({ height })} />
      {fills && (
        <Segmented
          label={infill === 'cables' ? 'Cable spacing' : 'Baluster spacing'}
          value={common(opts.map((o) => nearest(GAPS, o.gap).id)) ?? ''}
          options={GAPS.map((g) => ({ id: g.id, label: g.label }))}
          onChange={(id) => onEdit({ gap: GAPS.find((g) => g.id === id)!.value })}
        />
      )}
      {solid && wall !== false && (
        <LengthField label="Wall thickness" value={common(opts.map((o) => o.thickness ?? 0.07)) ?? 0.07} min={0.03} max={0.3} step={0.01} onCommit={(thickness) => onEdit({ thickness })} />
      )}
      <Segmented
        label="Posts"
        value={common(opts.map((o) => nearest(POSTS, o.post).id)) ?? ''}
        options={POSTS.map((p) => ({ id: p.id, label: p.label }))}
        onChange={(id) => onEdit({ post: POSTS.find((p) => p.id === id)!.value })}
      />
      {spacing && (
        <Segmented
          label="Post spacing"
          value={common(opts.map((o) => nearest(SPACINGS, o.spacing ?? 1.2).id)) ?? ''}
          options={SPACINGS.map((p) => ({ id: p.id, label: p.label }))}
          onChange={(id) => onEdit({ spacing: SPACINGS.find((p) => p.id === id)!.value })}
        />
      )}
      {sides && (
        <Segmented
          label="Rail on"
          value={common(opts.map((o) => o.sides)) ?? ''}
          options={[
            { id: 'both', label: 'Both sides' },
            { id: 'left', label: 'Left only' },
            { id: 'right', label: 'Right only' },
          ]}
          onChange={(v) => onEdit({ sides: v as 'both' | 'left' | 'right' })}
        />
      )}
      {inset && <LengthField label="Set in from edge" value={common(rails.map((r) => r.opts?.inset ?? 0.1)) ?? 0.1} min={0} max={1} step={0.05} onCommit={(v) => onEdit({ inset: v })} />}
      {edges && skip !== null && (
        <div className="f-group" role="group" aria-label="Railing sides">
          <div className="f-label">Sides with a railing</div>
          {edges.map((name, i) => (
            <Toggle
              key={name}
              label={name}
              checked={!skipped.includes(i)}
              onChange={(on) => {
                const next = on ? skipped.filter((k) => k !== i) : [...skipped, i].sort();
                onEdit({ skip: next });
              }}
            />
          ))}
        </div>
      )}
      {glass && (
        <Segmented
          label="Glass"
          value={common(rails.map((r) => r.opts?.tint ?? 'clear')) ?? ''}
          options={(Object.keys(GLASS_TINTS) as Array<keyof typeof GLASS_TINTS>).map((k) => ({ id: k as string, label: GLASS_TINTS[k].name }))}
          onChange={(v) => onEdit({ tint: v as keyof typeof GLASS_TINTS })}
        />
      )}
      <button type="button" className="pill small" title="Back to the plain look of the chosen railing" onClick={onReset}>
        Reset railing options
      </button>
    </>
  );
}
