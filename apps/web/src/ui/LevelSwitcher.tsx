import { useEffect, useRef, useState } from 'react';
import { PopClose } from './PopClose';
import { useStore } from 'zustand';
import { addLevel, copyLevel, removeLevel, setAutoRoofs, setLevelProps, setRoof, updateRoofs, type RoofInput } from '@hd/editor-core';
import { materialsFor } from '../view3d/placeholderMaterials';
import { editor, useUi } from '../plan/session';
import { AngleField, LengthField, Segmented, Swatches, TextField } from './fields';
import { GooGroup } from './Goo';
import { ViewsMenu } from './ViewsMenu';
import { NightButton } from './NightButton';
import { EnvironmentButton } from './EnvironmentButton';

/** One-glyph label for the narrow floor selector on phones: Ground floor → G, Floor 2 → 2, otherwise the initial. */
function shortName(name: string): string {
  if (/ground/i.test(name)) return 'G';
  const digits = name.match(/\d+/);
  return digits ? digits[0] : (name.trim()[0] ?? '?').toUpperCase();
}

const IconRoof = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M2.5 10.5L10 4L17.5 10.5M5 9V16H15V9" />
  </svg>
);
const IconCutaway = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 7L10 4L16 7V14L10 17L4 14ZM4 7L10 10L16 7M10 10V17" />
  </svg>
);

/**
 * Floor switcher: one chip per floor (bottom → top), "+" adds a floor, tapping the current floor again opens its
 * settings (name, height, copy, delete). "Cutaway" lowers the current floor's walls and hides the floors above
 * so you can look into the rooms from above.
 */
export function LevelSwitcher() {
  const levels = useStore(editor.store, (s) => s.scene.levels);
  const order = useStore(editor.store, (s) => s.scene.levelOrder);
  const active = useStore(editor.store, (s) => s.activeLevelId);
  const roofs = useStore(editor.store, (s) => s.scene.roofs);
  const showRoof = useUi((s) => s.showRoof);
  const toggleRoof = useUi((s) => s.toggleRoof);
  const cutaway = useUi((s) => s.cutaway);
  const toggleCutaway = useUi((s) => s.toggleCutaway);
  const bumpFit = useUi((s) => s.bumpFit);
  const view = useUi((s) => s.view);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const current = levels[active];
  if (!current) return null;
  const floorRoofs = Object.values(roofs).filter((r) => r.levelId === active);
  const roof = floorRoofs[0];
  const sameStyle = floorRoofs.length > 0 && floorRoofs.every((r) => r.style === roof!.style);
  /** Quick roof edit for the whole floor (the full roof designer is in the properties card). */
  const setFloorRoof = (props: RoofInput) => {
    if (props.style === 'none') return editor.execute(setRoof(active, props));
    const idsNow = () => Object.values(editor.getState().scene.roofs).filter((r) => r.levelId === active).map((r) => r.id);
    if (idsNow().length === 0) {
      editor.execute(setAutoRoofs(active, true));
      if (idsNow().length === 0) return editor.execute(setRoof(active, props)); // nothing to follow yet: one roof over the floor
    }
    return editor.execute(updateRoofs(idsNow(), props));
  };

  /** Run a command that creates a floor, then switch to it. */
  const addAndGo = (cmd: Parameters<typeof editor.execute>[0]) => {
    if (!editor.execute(cmd)) return;
    const top = editor.getState().scene.levelOrder.at(-1);
    if (top) editor.setActiveLevel(top);
    bumpFit();
    setOpen(false);
  };

  return (
    <div ref={root} className="levels" role="group" aria-label="Floors">
      <GooGroup className="segmented" data-goo-host="">
        {order.map((id) => {
          const lv = levels[id]!;
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              className={`seg${isActive ? ' caret' : ''}`}
              aria-pressed={isActive}
              title={isActive ? 'Floor settings' : `Go to ${lv.name}`}
              aria-label={lv.name}
              onClick={() => (isActive ? setOpen((o) => !o) : editor.setActiveLevel(id))}
            >
              <span className="lv-full">{lv.name}</span>
              <span className="lv-short" aria-hidden="true">
                {shortName(lv.name)}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className="seg"
          aria-label="Add floor"
          title="Add a floor on top"
          onClick={() => addAndGo(addLevel())}
        >
          +
        </button>
      </GooGroup>
      {view !== '2d' && Object.keys(roofs).length > 0 && (
        <button
          type="button"
          className="pill small"
          aria-pressed={!showRoof}
          title={showRoof ? 'Hide the roof to look inside' : 'Show the roof'}
          aria-label={showRoof ? 'Hide roof' : 'Show roof'}
          onClick={toggleRoof}
        >
          <IconRoof />
          <span className="lbl">{showRoof ? 'Hide roof' : 'Show roof'}</span>
        </button>
      )}
      {view !== '2d' && (
        <button
          type="button"
          className="pill small"
          aria-pressed={cutaway}
          title="Cut the current floor's walls low and hide floors above, to look into the rooms"
          aria-label="Cutaway"
          onClick={toggleCutaway}
        >
          <IconCutaway />
          <span className="lbl">Cutaway</span>
        </button>
      )}

      {view !== '2d' && <NightButton />}
      {view !== '2d' && <EnvironmentButton />}
      {view !== '2d' && <ViewsMenu />}
      {open && (
        <div className="popover above" role="group" aria-label="Floor settings">
          <PopClose onClick={() => setOpen(false)} />
          <TextField
            label="Name"
            value={current.name}
            onCommit={(name) => editor.execute(setLevelProps(active, { name }))}
          />
          <LengthField
            label="Height"
            hint="Floor to floor"
            value={current.height}
            min={2}
            max={6}
            onCommit={(height) => editor.execute(setLevelProps(active, { height }))}
          />
          {active === order[order.length - 1] && (
            <>
              <Segmented
                label="Roof"
                value={roof ? (sameStyle ? roof.style : '') : 'none'}
                options={[
                  { id: 'none', label: 'None' },
                  { id: 'flat', label: 'Flat' },
                  { id: 'shed', label: 'Shed' },
                  { id: 'gable', label: 'Gable' },
                  { id: 'hip', label: 'Hip' },
                  { id: 'butterfly', label: 'Butterfly' },
                  { id: 'mansard', label: 'Mansard' },
                  { id: 'barrel', label: 'Barrel' },
                ]}
                onChange={(style) => setFloorRoof({ style: style as RoofInput['style'] })}
              />
              {roof && (
                <>
                  {roof.style !== 'flat' && roof.style !== 'barrel' && (
                    <AngleField
                      label="Slope"
                      value={roof.pitchDeg}
                      onCommit={(pitchDeg) => setFloorRoof({ pitchDeg })}
                    />
                  )}
                  <LengthField
                    label="Overhang"
                    value={roof.overhang}
                    min={0}
                    max={1.5}
                    step={0.05}
                    onCommit={(overhang) => setFloorRoof({ overhang })}
                  />
                  <Swatches
                    label="Roof material"
                    items={materialsFor('roof')}
                    value={roof.material.id}
                    onPick={(materialId) => setFloorRoof({ materialId })}
                  />
                  {(roof.style === 'gable' || roof.style === 'hip') && (
                    <button
                      type="button"
                      className="pill small"
                      onClick={() => setFloorRoof({ swap: !roof.ridgeAngle })}
                    >
                      Turn the ridge 90°
                    </button>
                  )}
                </>
              )}
            </>
          )}
          <div className="level-actions">
            <button
              type="button"
              className="pill small"
              title="Duplicate this floor's walls, doors and rooms on a new floor on top"
              onClick={() => addAndGo(copyLevel(active))}
            >
              Copy to a new floor
            </button>
            <button
              type="button"
              className="pill small"
              disabled={order.length <= 1}
              title={
                order.length <= 1
                  ? 'A home needs at least one floor'
                  : 'Delete this floor and everything on it'
              }
              onClick={() => {
                editor.execute(removeLevel(active));
                setOpen(false);
              }}
            >
              Delete floor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
