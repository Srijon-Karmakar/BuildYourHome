import type { Item } from '@hd/scene-schema';
import { getAsset } from '@hd/assets';
import { setItemsSize } from '@hd/editor-core';
import { editor } from '../plan/session';
import { Chips, LengthField } from './fields';

/** Growth stages: a share of the catalog tree's full size. */
const STAGES = [
  { label: 'Sapling', value: 0.3 },
  { label: 'Young', value: 0.55 },
  { label: 'Grown', value: 1 },
  { label: 'Mature', value: 1.35 },
];

const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
const common = (vals: readonly number[]): number | null => (vals.length > 0 && vals.every((v) => near(v, vals[0]!)) ? vals[0]! : null);

/** True for the trees of the catalog (not bushes, flowers or pots). */
export const isTree = (assetId: string): boolean => assetId.startsWith('tree-');

/** Tree size: a growth stage and, on their own, the height and the width of the crown. */
export function TreeSize({ items }: { items: Item[] }) {
  const ids = items.map((i) => i.id);
  const assets = items.map((i) => getAsset(i.assetId));
  if (assets.some((a) => !a)) return null;
  const heights = items.map((it, i) => assets[i]!.size[2] * it.scale[1]);
  const widths = items.map((it, i) => assets[i]!.size[0] * it.scale[0]);
  const uniform = common(items.map((i) => (near(i.scale[0], i.scale[1]) && near(i.scale[0], i.scale[2]) ? i.scale[0] : NaN)));
  return (
    <>
      <div className="f-label" style={{ margin: '6px 0 6px' }}>
        Growth
        <small>{STAGES.find((s) => uniform !== null && near(s.value, uniform))?.label ?? 'Custom'}</small>
      </div>
      <Chips items={STAGES} current={uniform} onPick={(uniformScale) => editor.execute(setItemsSize(ids, { uniform: uniformScale }))} />
      <LengthField label="Height" value={common(heights)} min={0.5} max={20} step={0.1} onCommit={(m) => editor.execute(setItemsSize(items.map((i) => i.id), { height: m / assets[0]!.size[2] }))} />
      <LengthField label="Crown width" value={common(widths)} min={0.4} max={20} step={0.1} onCommit={(m) => editor.execute(setItemsSize(items.map((i) => i.id), { width: m / assets[0]!.size[0] }))} />
    </>
  );
}
