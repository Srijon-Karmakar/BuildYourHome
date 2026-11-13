import { useRef, useState } from 'react';
import { getAsset } from '@hd/assets';
import { setItemsProps, setItemsSize } from '@hd/editor-core';
import { SCREEN_DEMOS, type Item, type ScreenOpts } from '@hd/scene-schema';
import { editor } from '../plan/session';
import { SCREEN_DEFAULTS, screenLook, shrinkPicture } from '../view3d/screenArt';
import { ColorField, LengthField, Row, Segmented, SelectField, TextField, Toggle } from './fields';

const SHOWS = [
  { id: 'demo', label: 'Picture' },
  { id: 'image', label: 'My photo' },
  { id: 'text', label: 'Text' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'color', label: 'Colour' },
  { id: 'off', label: 'Off' },
] as const;

const DEMO_NAMES: Record<(typeof SCREEN_DEMOS)[number], string> = {
  landscape: 'Landscape',
  city: 'City at night',
  sports: 'Sports',
  news: 'News',
  bars: 'Chart',
  stage: 'Live stage',
};

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
const common = <T,>(vals: readonly T[], eq: (a: T, b: T) => boolean = (a, b) => a === b): T | null => (vals.length > 0 && vals.every((v) => eq(v, vals[0]!)) ? vals[0]! : null);

/** Everything an LED screen can be set to. Works on one or several screens of the same kind. */
export function ScreenPanel({ items }: { items: Item[] }) {
  const ids = items.map((i) => i.id);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const assets = items.map((i) => getAsset(i.assetId));
  if (assets.some((a) => !a?.screen)) return null;
  const looks = items.map((it, i) => screenLook(it, assets[i]!));
  const first = looks[0]!;
  const show = common(looks.map((l) => l.show));
  const set = (screen: { [K in keyof ScreenOpts]?: ScreenOpts[K] | null }) => editor.execute(setItemsProps(ids, { screen }));
  const face = assets[0]!.screen!;
  const widths = items.map((it, i) => assets[i]!.screen!.w * it.scale[0]);
  const heights = items.map((it, i) => assets[i]!.screen!.h * it.scale[1]);
  const curve = common(looks.map((l) => l.curve), near) ?? 0;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    try {
      const image = await shrinkPicture(f);
      set({ show: 'image', image });
    } catch {
      setMsg('That file is not a picture we can read.');
    }
  };

  return (
    <>
      <Segmented label="Shows" value={show} options={SHOWS.map((s) => ({ id: s.id, label: s.label }))} onChange={(v) => set({ show: v })} />

      {show === 'demo' && (
        <SelectField
          label="Picture"
          value={common(looks.map((l) => l.demo)) ?? first.demo}
          options={SCREEN_DEMOS.map((d) => ({ id: d, label: DEMO_NAMES[d] }))}
          onChange={(demo) => set({ demo })}
        />
      )}

      {show === 'image' && (
        <>
          <div className="f-chips">
            <button type="button" onClick={() => file.current?.click()}>
              {first.image ? 'Change photo' : 'Choose a photo'}
            </button>
            {first.image && (
              <button type="button" onClick={() => set({ image: null })}>
                Remove
              </button>
            )}
          </div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <Segmented
            label="Fit"
            value={common(looks.map((l) => l.fit))}
            options={[
              { id: 'cover', label: 'Fill' },
              { id: 'contain', label: 'Whole picture' },
              { id: 'stretch', label: 'Stretch' },
            ]}
            onChange={(fit) => set({ fit })}
          />
          {msg && <p className="f-note">{msg}</p>}
          <p className="f-note">Photos are shrunk to fit in your home file.</p>
        </>
      )}

      {show === 'text' && (
        <>
          <TextField label="Text" value={first.text} maxLength={80} onCommit={(text) => set({ text })} />
          <Toggle label="Scroll across" hint="Like a shop ticker" checked={looks.every((l) => l.scroll)} onChange={(scroll) => set({ scroll })} />
          <ColorField label="Text colour" value={first.textColor} onCommit={(textColor) => set({ textColor })} />
        </>
      )}

      {(show === 'text' || show === 'color' || show === 'gradient') && (
        <ColorField label={show === 'gradient' ? 'From' : 'Background'} value={first.color} onCommit={(color) => set({ color })} />
      )}
      {show === 'gradient' && <ColorField label="To" value={first.color2} onCommit={(color2) => set({ color2 })} />}

      {show !== 'off' && (
        <Row label="Brightness" hint="Above 100 % it glows at night">
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.05}
            aria-label="Brightness"
            value={common(looks.map((l) => l.brightness), near) ?? 1}
            onChange={(e) => set({ brightness: Number(e.target.value) })}
          />
        </Row>
      )}

      <LengthField label="Width" value={common(widths, near)} min={0.2} max={20} step={0.05} onCommit={(m) => editor.execute(setItemsSize(ids, { panelWidth: m / face.w }))} />
      <LengthField label="Height" value={common(heights, near)} min={0.1} max={12} step={0.05} onCommit={(m) => editor.execute(setItemsSize(ids, { panelHeight: m / face.h }))} />
      <LengthField
        label="Height above floor"
        value={common(items.map((i) => i.position[1]), near)}
        min={0}
        max={40}
        step={0.05}
        onCommit={(elevation) => editor.execute(setItemsProps(ids, { elevation }))}
      />
      {face.curvable && (
        <Row label="Curve" hint={curve === 0 ? 'Flat' : curve > 0 ? 'Bulges out' : 'Curves in'}>
          <input
            type="range"
            min={-180}
            max={180}
            step={5}
            aria-label="Curve"
            value={curve}
            onChange={(e) => set({ curve: Number(e.target.value) || null })}
          />
        </Row>
      )}
      <Row label="Frame">
        <input
          type="range"
          min={0}
          max={0.15}
          step={0.005}
          aria-label="Frame thickness"
          value={common(looks.map((l) => l.bezel), near) ?? SCREEN_DEFAULTS.bezel}
          onChange={(e) => set({ bezel: Number(e.target.value) })}
        />
      </Row>
      <Toggle label="Lights the room at night" checked={looks.every((l) => l.castLight)} onChange={(castLight) => set({ castLight })} />
      <div className="f-chips">
        <button type="button" onClick={() => editor.execute(setItemsProps(ids, { screen: null }))}>
          Reset screen
        </button>
      </div>
    </>
  );
}

/** Height above the floor for items that can hang or stand high (outdoor AC units on a wall bracket, window units). */
export function MountHeight({ items }: { items: Item[] }) {
  const ids = items.map((i) => i.id);
  const h = common(items.map((i) => i.position[1]), near);
  return <LengthField label="Height above floor" value={h} min={0} max={40} step={0.05} onCommit={(elevation) => editor.execute(setItemsProps(ids, { elevation }))} />;
}
