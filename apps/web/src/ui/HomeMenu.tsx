import { useEffect, useRef, useState } from 'react';
import { PopClose } from './PopClose';
import { useStore } from 'zustand';
import { WALL_THICKNESS_EXTERIOR_M, WALL_THICKNESS_INTERIOR_M } from '@hd/scene-schema';
import {
  batch,
  applyEnvironment,
  boundaryKind,
  clearEnvironment,
  ENVIRONMENTS,
  hasEnvironment,
  DEFAULT_PLOT_MARGIN_M,
  nodesOutsidePlot,
  setBoundary,
  setDefaults,
  setGround,
  setPlot,
  setPlotAroundHouse,
  setSceneName,
  setUnits,
} from '@hd/editor-core';
import { polygonArea } from '@hd/geometry';
import { editor, useUi } from '../plan/session';
import { materialsFor } from '../view3d/placeholderMaterials';
import { ExportActions } from './ExportActions';
import { FileActions } from './FileActions';
import { formatArea } from '../lib/units';
import { LengthField, Section, Segmented, Swatches, TextField, Toggle } from './fields';

/** Project-level settings: name, the ground around the house, and thickness for newly drawn walls. */
export function HomeMenu({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
  const [open, setOpen] = useState(false);
  const scene = useStore(editor.store, (s) => s.scene);
  const pro = useUi((s) => s.pro);
  const setPro = useUi((s) => s.setPro);
  const root = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(DEFAULT_PLOT_MARGIN_M);
  const setTool = useUi((s) => s.setTool);
  const plot = scene.plot?.boundary;
  const outside = nodesOutsidePlot(scene).length;
  const hasEnv = hasEnvironment(scene);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

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

  return (
    <div ref={root} className="menu-anchor">
      <button
        type="button"
        className="pill quiet"
        title="Name, ground and wall defaults"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Home
      </button>
      {open && (
        <div className="popover below home-pop" role="group" aria-label="Home settings">
          <PopClose onClick={() => setOpen(false)} />
          <Section title="Your home">
            <TextField label="Name" value={scene.meta.name} onCommit={(name) => editor.execute(setSceneName(name))} />
            <Swatches
              label="Ground"
              items={materialsFor('ground')}
              value={scene.terrain.groundMaterial.id}
              onPick={(id) => editor.execute(setGround({ id }))}
            />
          </Section>
          <Section title="Plot & site">
            {plot ? (
              <>
                <small className="fine" data-testid="plot-area">
                  Plot area {formatArea(polygonArea(plot), scene.meta.units)}
                </small>
                {outside > 0 && (
                  <small className="fine" role="alert" data-testid="plot-warning">
                    {outside} point{outside === 1 ? '' : 's'} of your house {outside === 1 ? 'is' : 'are'} outside the plot.
                  </small>
                )}
                <Segmented
                  label="Boundary"
                  value={boundaryKind(scene)}
                  options={[
                    { id: 'none', label: 'None' },
                    { id: 'wall', label: 'Wall' },
                    { id: 'fence', label: 'Fence' },
                  ]}
                  onChange={(k) => editor.execute(setBoundary(k))}
                />
              </>
            ) : (
              <small className="fine">Mark the land your house stands on. Grass and paving then stay inside it.</small>
            )}
            <LengthField label="Space around house" value={margin} min={0} max={30} step={0.5} onCommit={setMargin} />
            <div className="f-actions">
              <button type="button" className="pill small" onClick={() => editor.execute(setPlotAroundHouse(margin))}>
                {plot ? 'Reset around house' : 'Plot around my house'}
              </button>
              <button
                type="button"
                className="pill small"
                onClick={() => {
                  setTool('plot');
                  setOpen(false);
                }}
              >
                Draw by hand
              </button>
              {plot && (
                <button
                  type="button"
                  className="pill small"
                  onClick={() => {
                    editor.execute(batch('Remove plot', [setBoundary('none'), setPlot(null)]));
                  }}
                >
                  Remove plot
                </button>
              )}
            </div>
          </Section>
          <Section title="Surroundings">
            <small className="fine">One tap sets the ground and adds neighbours, trees, roads or water around your house. You can move or delete any piece afterwards.</small>
            <div className="f-actions">
              {ENVIRONMENTS.map((env) => (
                <button key={env.id} type="button" className="pill small" title={env.description} onClick={() => editor.execute(applyEnvironment(env.id))}>
                  {env.name}
                </button>
              ))}
              {hasEnv && (
                <button type="button" className="pill small" onClick={() => editor.execute(clearEnvironment())}>
                  Clear
                </button>
              )}
            </div>
          </Section>
          <Section title="Units & tools">
            <Segmented
              label="Units"
              value={scene.meta.units}
              options={[
                { id: 'm', label: 'Metres' },
                { id: 'ft', label: 'Feet & inches' },
              ]}
              onChange={(u) => editor.execute(setUnits(u))}
            />
            <Toggle label="Pro tools" hint="Overall dimensions, room sizes and every wall length" checked={pro} onChange={setPro} />
          </Section>
          <Section title="File">
            <FileActions onDone={() => setOpen(false)} />
          </Section>
          <Section title="Export">
            <ExportActions />
          </Section>
          <Section title="New walls">
            <LengthField
              label="Inside walls"
              value={scene.defaults?.interiorThickness ?? WALL_THICKNESS_INTERIOR_M}
              min={0.05}
              max={1}
              step={0.005}
              onCommit={(interiorThickness) => editor.execute(batch('Change defaults', [setDefaults({ interiorThickness })]))}
            />
            <LengthField
              label="Outside walls"
              value={scene.defaults?.exteriorThickness ?? WALL_THICKNESS_EXTERIOR_M}
              min={0.05}
              max={1}
              step={0.005}
              onCommit={(exteriorThickness) => editor.execute(batch('Change defaults', [setDefaults({ exteriorThickness })]))}
            />
            <small className="fine">Applies to walls you draw from now on. Existing walls keep their thickness.</small>
          </Section>
        </div>
      )}
    </div>
  );
}
