import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import {
  applyEnvironmentLook,
  COMPASS_SIDES,
  encodeEnvironment,
  ENVIRONMENT_LOOKS,
  resetEnvironment,
  resolveEnvironment,
  SCENERY_HEIGHTS,
  SCENERY_KINDS,
  SCENERY_TONES,
  setGround,
  setScenery,
  setTimeOfDay,
  setWeather,
  updateEnvironment,
  type Clouds,
  type CompassSide,
  type Haze,
  type SkyLook,
  type TreeKind,
  type TreeRing,
  type GroundDetailAmount,
} from '@hd/editor-core';
import type { SceneryKind, ScenerySide } from '@hd/scene-schema';
import { editor, useUi } from '../plan/session';
import { materialsFor } from '../view3d/placeholderMaterials';
import { WEATHERS } from '../view3d/weather';
import { Section, Segmented, Swatches, Toggle } from './fields';

const GROUND_PICKS = ['ground-grass', 'ground-lawn-light', 'ground-lawn-dark', 'ground-lawn-meadow', 'ground-moss', 'ground-soil', 'ground-red-earth', 'ground-clay', 'ground-sand', 'ground-sand-red', 'ground-gravel', 'ground-paving', 'ground-snow'];
const HAS_RELIEF: SceneryKind[] = ['hills', 'mountains', 'forest', 'desert'];
const SIDE_LABEL: Record<CompassSide, string> = { north: 'North', east: 'East', south: 'South', west: 'West' };
const kindLabel = (k: SceneryKind) => SCENERY_KINDS.find((x) => x.id === k)?.label ?? k;

const TIMES = [
  { id: 'morning', label: 'Morning', hour: 8 },
  { id: 'noon', label: 'Noon', hour: 12 },
  { id: 'evening', label: 'Evening', hour: 17.5 },
  { id: 'night', label: 'Night', hour: 22 },
];

const common = <T,>(vals: readonly T[]): T | null => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0]! : null);
const nearestHeight = (v: number) => SCENERY_HEIGHTS.reduce((b, h) => (Math.abs(h.value - v) < Math.abs(b.value - v) ? h : b), SCENERY_HEIGHTS[1]!);

/** Is the panel showing? (Not in the plan-only view, in walk mode or in a read-only share.) */
export function useEnvPanelVisible(): boolean {
  const open = useUi((s) => s.envOpen);
  const walk = useUi((s) => s.walk);
  const viewOnly = useUi((s) => s.viewOnly);
  const view = useUi((s) => s.view);
  return open && !walk && !viewOnly && view !== '2d';
}

/**
 * The environment editor: what stands far away on each side of the home, the sky and the air, the ground and a ring of
 * trees, plus one-tap looks to start from. It stays open while you look around the 3D view.
 */
export function EnvironmentPanel() {
  const visible = useEnvPanelVisible();
  const lighting = useStore(editor.store, (s) => s.scene.lighting);
  const ground = useStore(editor.store, (s) => s.scene.terrain.groundMaterial.id);
  const [side, setSide] = useState<CompassSide | 'all'>('north');

  useEffect(() => {
    if (!visible) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) useUi.getState().setEnvOpen(false);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [visible]);

  if (!visible) return null;
  const env = resolveEnvironment(lighting);
  const targets = side === 'all' ? [...COMPASS_SIDES] : [side];
  const picked = targets.map((s) => env.sides[s]);
  const kind = common(picked.map((p) => p.kind));
  const showsRelief = picked.some((p) => HAS_RELIEF.includes(p.kind));
  const showsSnow = picked.some((p) => p.kind === 'mountains');
  const edit = (patch: Partial<ScenerySide>) => editor.execute(setScenery(side, patch));
  const set = (patch: Parameters<typeof updateEnvironment>[0]) => editor.execute(updateEnvironment(patch));
  const currentLook = JSON.stringify(encodeEnvironment(env) ?? null);
  const look = ENVIRONMENT_LOOKS.find((l) => JSON.stringify(encodeEnvironment(resolveEnvironment({ timeOfDay: 12, environment: l.settings })) ?? null) === currentLook);
  const hour = lighting.timeOfDay;

  return (
    <aside className="inspector env-panel" aria-label="Environment">
      <header>
        <div className="ins-title static">
          <strong>Environment</strong>
          <small>The place around your home</small>
        </div>
        <div className="ins-actions">
          <button type="button" className="ins-close" title="Close (Esc)" aria-label="Close the environment editor" onClick={() => useUi.getState().setEnvOpen(false)}>
            ×
          </button>
        </div>
      </header>
      <div className="ins-body">
        <Section title="Start from">
          <Segmented label="Look" value={look?.id ?? ''} options={ENVIRONMENT_LOOKS.map((l) => ({ id: l.id, label: l.name }))} onChange={(id) => editor.execute(applyEnvironmentLook(id))} />
          <p className="f-note">{look ? look.description : 'Your own mix. Pick a look to start over from a ready-made one.'}</p>
        </Section>

        <Section title="Scenery in the distance">
          <div className="env-compass" role="group" aria-label="Side of the home">
            {COMPASS_SIDES.map((s) => (
              <button key={s} type="button" className={`env-${s}`} aria-pressed={side === s} onClick={() => setSide(s)}>
                {SIDE_LABEL[s]}
                <small>{kindLabel(env.sides[s].kind)}</small>
              </button>
            ))}
            <div className="env-home" aria-hidden="true">
              Home
            </div>
          </div>
          <button type="button" className="pill small" aria-pressed={side === 'all'} onClick={() => setSide(side === 'all' ? 'north' : 'all')}>
            All four sides
          </button>
          <Segmented label={side === 'all' ? 'On every side' : `${SIDE_LABEL[side]} side`} value={kind} options={SCENERY_KINDS.map((k) => ({ id: k.id, label: k.label }))} onChange={(k) => edit({ kind: k })} />
          {showsRelief && (
            <>
              <Segmented label="Height" value={common(picked.map((p) => nearestHeight(p.height).id))} options={SCENERY_HEIGHTS.map((h) => ({ id: h.id, label: h.label }))} onChange={(id) => edit({ height: SCENERY_HEIGHTS.find((h) => h.id === id)!.value })} />
              <Segmented label="Colour" value={common(picked.map((p) => p.tone))} options={SCENERY_TONES.map((t) => ({ id: t.id, label: t.label }))} onChange={(tone) => edit({ tone })} />
            </>
          )}
          {showsSnow && <Toggle label="Snow on the mountain tops" checked={picked.filter((p) => p.kind === 'mountains').every((p) => p.snow)} onChange={(snow) => edit({ snow })} />}
        </Section>

        <Section title="Sky and air">
          <Segmented label="Time of day" value={TIMES.find((t) => Math.abs(hour - t.hour) < 0.01)?.id ?? ''} options={TIMES.map((t) => ({ id: t.id, label: t.label }))} onChange={(id) => editor.execute(setTimeOfDay(TIMES.find((t) => t.id === id)!.hour))} />
          <Segmented label="Weather" value={lighting.weather ?? 'clear'} options={WEATHERS.map((w) => ({ id: w.id, label: w.label }))} onChange={(w) => editor.execute(setWeather(w))} />
          <Segmented
            label="Clouds"
            value={env.clouds ?? 'auto'}
            options={[{ id: 'auto', label: 'By weather' }, { id: 'none', label: 'None' }, { id: 'few', label: 'A few' }, { id: 'many', label: 'Many' }]}
            onChange={(c) => set({ clouds: c === 'auto' ? null : (c as Clouds) })}
          />
          <Segmented label="Haze" value={env.haze} options={[{ id: 'none', label: 'Clear air' }, { id: 'light', label: 'Light' }, { id: 'misty', label: 'Misty' }]} onChange={(haze) => set({ haze: haze as Haze })} />
          <Segmented label="Sky colour" value={env.sky} options={[{ id: 'natural', label: 'Natural' }, { id: 'deep', label: 'Deep blue' }, { id: 'pale', label: 'Pale' }, { id: 'dusty', label: 'Dusty' }]} onChange={(sky) => set({ sky: sky as SkyLook })} />
          <p className="f-note">Sky colour shows on clear days. Rain keeps the screen busy, so it uses more battery.</p>
          <Toggle label="Birds" checked={env.birds} onChange={(birds) => set({ birds })} />
        </Section>

        <Section title="Ground and plants">
          <Swatches label="Ground" items={materialsFor('ground').filter((m) => GROUND_PICKS.includes(m.id))} value={ground} onPick={(id) => editor.execute(setGround({ id }))} />
          <Segmented label="Grass, pebbles, leaves" value={env.detail} options={[{ id: 'none', label: 'None' }, { id: 'some', label: 'Some' }, { id: 'lots', label: 'Lots' }]} onChange={(detail) => set({ detail: detail as GroundDetailAmount })} />
          <Segmented label="Ring of trees round the plot" value={env.trees} options={[{ id: 'none', label: 'None' }, { id: 'sparse', label: 'Sparse' }, { id: 'dense', label: 'Dense' }]} onChange={(trees) => set({ trees: trees as TreeRing })} />
          {env.trees !== 'none' && (
            <Segmented label="Kind of tree" value={env.treeKind} options={[{ id: 'mixed', label: 'Mixed' }, { id: 'palm', label: 'Palms' }, { id: 'pine', label: 'Pines' }, { id: 'neem', label: 'Neem' }]} onChange={(treeKind) => set({ treeKind: treeKind as TreeKind })} />
          )}
          <p className="f-note">The ground colour here is the same as Home › Ground. Grass, pebbles and leaves show on Medium and High quality.</p>
        </Section>

        <div className="env-foot">
          <button type="button" className="pill small" onClick={() => editor.execute(resetEnvironment())}>
            Reset to open land
          </button>
        </div>
      </div>
    </aside>
  );
}
