import { getAsset } from '@hd/assets';
import { setItemsProps, setItemsSize } from '@hd/editor-core';
import type { FeatureOpts, Item } from '@hd/scene-schema';
import { editor } from '../plan/session';
import { featureLook } from '../view3d/featureGeo';
import { finishMaterials, paintMaterials } from '../view3d/placeholderMaterials';
import { ColorField, LengthField, Row, Swatches, Toggle } from './fields';

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
const common = <T,>(vals: readonly T[], eq: (a: T, b: T) => boolean = (a, b) => a === b): T | null => (vals.length > 0 && vals.every((v) => eq(v, vals[0]!)) ? vals[0]! : null);

/** Everything a wall feature (extra / curved / box / extended wall) can be set to: finish, size, thickness, bend, cap, height. */
export function FeaturePanel({ items }: { items: Item[] }) {
  const ids = items.map((i) => i.id);
  const assets = items.map((i) => getAsset(i.assetId));
  if (assets.some((a) => !a?.feature)) return null;
  const looks = items.map((it, i) => featureLook(it, assets[i]!));
  const set = (feature: { [K in keyof FeatureOpts]?: FeatureOpts[K] | null }) => editor.execute(setItemsProps(ids, { feature }));
  const face = assets[0]!.feature!;
  const widths = items.map((it, i) => assets[i]!.feature!.w * it.scale[0]);
  const heights = items.map((it, i) => assets[i]!.feature!.h * it.scale[1]);
  const depths = items.map((it, i) => assets[i]!.feature!.depth * it.scale[2]);
  const allCurved = looks.every((l) => l.shape === 'curved');
  const noneCurved = looks.every((l) => l.shape !== 'curved');
  const box = looks.every((l) => l.shape === 'box');
  const material = common(looks.map((l) => l.material));
  const curve = common(looks.map((l) => l.curve), near) ?? 0;

  return (
    <>
      <Swatches label="Paint" items={paintMaterials()} value={material} onPick={(id) => set({ material: id })} />
      <Swatches label="Finish" items={finishMaterials()} value={material} onPick={(id) => set({ material: id })} />
      <ColorField label="Tint" value={items[0]!.variant ?? '#ffffff'} onCommit={(variant) => editor.execute(setItemsProps(ids, { variant }))} />
      {items.some((i) => i.variant) && (
        <div className="f-chips">
          <button type="button" onClick={() => editor.execute(setItemsProps(ids, { variant: null }))}>
            Remove tint
          </button>
        </div>
      )}
      <LengthField label="Width" hint={allCurved ? 'Tip to tip' : undefined} value={common(widths, near)} min={0.2} max={30} step={0.1} onCommit={(m) => editor.execute(setItemsSize(ids, { panelWidth: m / face.w }))} />
      <LengthField label="Height" value={common(heights, near)} min={0.2} max={20} step={0.1} onCommit={(m) => editor.execute(setItemsSize(ids, { panelHeight: m / face.h }))} />
      <LengthField
        label={box ? 'Projection' : 'Thickness'}
        hint={box ? 'Out from the wall' : undefined}
        value={common(depths, near)}
        min={0.05}
        max={box ? 3 : 1.2}
        step={box ? 0.1 : 0.05}
        onCommit={(m) => editor.execute(setItemsSize(ids, { panelDepth: m / face.depth }))}
      />
      <LengthField
        label="Height above floor"
        hint="Raise it onto a roof or terrace"
        value={common(items.map((i) => i.position[1]), near)}
        min={0}
        max={40}
        step={0.1}
        onCommit={(elevation) => editor.execute(setItemsProps(ids, { elevation }))}
      />
      {allCurved && (
        <Row label="Curve" hint={curve === 0 ? 'Straight' : curve > 0 ? 'Bulges forward' : 'Curves back'}>
          <input type="range" min={-180} max={180} step={5} aria-label="Curve" value={curve} onChange={(e) => set({ curve: Number(e.target.value) || null })} />
        </Row>
      )}
      {noneCurved && <Toggle label="Cap along the top" hint="A coping stone" checked={looks.every((l) => l.cap)} onChange={(cap) => set({ cap })} />}
      <div className="f-chips">
        <button type="button" onClick={() => editor.execute(setItemsProps(ids, { feature: null, variant: null }))}>
          Reset wall
        </button>
      </div>
    </>
  );
}
