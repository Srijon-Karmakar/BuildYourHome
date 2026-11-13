import { getAsset } from '@hd/assets';
import { setItemsProps, setItemsSize } from '@hd/editor-core';
import { CURTAIN_STYLES, type CurtainOpts, type Item } from '@hd/scene-schema';
import { editor } from '../plan/session';
import { curtainLook, isBlind } from '../view3d/curtainShape';
import { ColorField, ColorSwatches, Chips, LengthField, Row, Segmented, Toggle } from './fields';

const NAMES: Record<(typeof CURTAIN_STYLES)[number], string> = { pleated: 'Pleated', eyelet: 'Eyelet', sheer: 'Sheer', roman: 'Roman blind', venetian: 'Venetian blind' };
const FULLNESS = [
  { label: 'Light', value: 1.5 },
  { label: 'Standard', value: 2.2 },
  { label: 'Rich', value: 2.8 },
];
const RODS = [
  { id: '#c9a47a', name: 'Brass' },
  { id: '#2b2a28', name: 'Black' },
  { id: '#c9cbcd', name: 'Chrome' },
  { id: '#f1efea', name: 'White' },
  { id: '#b98a5b', name: 'Oak' },
];

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
const common = <T,>(vals: readonly T[], eq: (a: T, b: T) => boolean = (a, b) => a === b): T | null => (vals.length > 0 && vals.every((v) => eq(v, vals[0]!)) ? vals[0]! : null);

/** Everything a curtain or blind can be set to: style, size, hem height, how open, fullness, colours, sheer layer, rod. */
export function CurtainPanel({ items }: { items: Item[] }) {
  const ids = items.map((i) => i.id);
  const assets = items.map((i) => getAsset(i.assetId));
  if (assets.some((a) => !a?.curtain)) return null;
  const looks = items.map((it, i) => curtainLook(it, assets[i]!));
  const first = looks[0]!;
  const style = common(looks.map((l) => l.style));
  const blind = style !== null && isBlind(style);
  const anyBlind = looks.some((l) => isBlind(l.style));
  const set = (curtain: { [K in keyof CurtainOpts]?: CurtainOpts[K] | null }) => editor.execute(setItemsProps(ids, { curtain }));
  const face = assets[0]!.curtain!;
  const widths = items.map((it, i) => assets[i]!.curtain!.w * it.scale[0]);
  const heights = items.map((it, i) => assets[i]!.curtain!.h * it.scale[1]);
  // The item's origin is the middle of the hanging cloth; the hem is half its height below that.
  const hems = items.map((it, i) => it.position[1] - heights[i]! / 2);
  const fabricColor = common(items.map((it, i) => it.variant ?? assets[i]!.colors?.[0]?.id ?? '#9a9690'));

  return (
    <>
      <Segmented label="Style" value={style} options={CURTAIN_STYLES.map((s) => ({ id: s, label: NAMES[s] }))} onChange={(s) => set({ style: s, rod: isBlind(s) ? 'none' : null })} />
      <LengthField label="Width" value={common(widths, near)} min={0.2} max={12} step={0.05} onCommit={(m) => editor.execute(setItemsSize(ids, { panelWidth: m / face.w }))} />
      <LengthField label="Height" value={common(heights, near)} min={0.2} max={8} step={0.05} onCommit={(m) => editor.execute(setItemsSize(ids, { panelHeight: m / face.h }))} />
      <LengthField
        label="Hem above floor"
        hint="Bottom edge"
        value={common(hems, near)}
        min={0}
        max={20}
        step={0.05}
        onCommit={(hem) => editor.execute(setItemsProps(ids, { elevation: hem + (common(heights, near) ?? heights[0]!) / 2 }))}
      />
      <Row label={anyBlind ? 'Raised' : 'Drawn open'} hint={anyBlind ? 'Down to raised' : 'Closed to open'}>
        <input type="range" min={0} max={1} step={0.05} aria-label="How open" value={common(looks.map((l) => l.open), near) ?? 0} onChange={(e) => set({ open: Number(e.target.value) || null })} />
      </Row>
      {!anyBlind && (
        <>
          <div className="f-label" style={{ margin: '6px 0 6px' }}>
            Fullness
            <small>Gathered cloth</small>
          </div>
          <Chips items={FULLNESS} current={common(looks.map((l) => FULLNESS.reduce((best, f) => (Math.abs(f.value - l.fullness) < Math.abs(best - l.fullness) ? f.value : best), FULLNESS[0]!.value)))} onPick={(fullness) => set({ fullness })} />
        </>
      )}
      <ColorField label="Custom colour" value={fabricColor ?? '#9a9690'} onCommit={(variant) => editor.execute(setItemsProps(ids, { variant }))} />
      {!anyBlind && style !== 'sheer' && (
        <>
          <Toggle label="Sheer curtain behind" hint="A light voile layer" checked={looks.every((l) => l.sheer)} onChange={(sheer) => set({ sheer })} />
          {looks.every((l) => l.sheer) && <ColorField label="Sheer colour" value={first.sheerColor} onCommit={(sheerColor) => set({ sheerColor })} />}
        </>
      )}
      {!blind && (
        <>
          <Segmented
            label="Rod"
            value={common(looks.map((l) => l.rod))}
            options={[
              { id: 'rod', label: 'Rod' },
              { id: 'track', label: 'Track' },
              { id: 'none', label: 'None' },
            ]}
            onChange={(rod) => set({ rod })}
          />
          {looks.some((l) => l.rod === 'rod') && <ColorSwatches label="Rod colour" items={RODS} value={common(looks.map((l) => l.rodColor))} onPick={(rodColor) => set({ rodColor })} />}
        </>
      )}
      <div className="f-chips">
        <button type="button" onClick={() => editor.execute(setItemsProps(ids, { curtain: null }))}>
          Reset curtain
        </button>
      </div>
    </>
  );
}
