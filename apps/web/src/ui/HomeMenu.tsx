import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { WALL_THICKNESS_EXTERIOR_M, WALL_THICKNESS_INTERIOR_M } from '@hd/scene-schema';
import { batch, setDefaults, setGround, setSceneName } from '@hd/editor-core';
import { editor } from '../plan/session';
import { materialsFor } from '../view3d/placeholderMaterials';
import { FileActions } from './FileActions';
import { LengthField, Section, Swatches, TextField } from './fields';

/** Project-level settings: name, the ground around the house, and thickness for newly drawn walls. */
export function HomeMenu() {
  const [open, setOpen] = useState(false);
  const scene = useStore(editor.store, (s) => s.scene);
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
          <Section title="Your home">
            <TextField label="Name" value={scene.meta.name} onCommit={(name) => editor.execute(setSceneName(name))} />
            <Swatches
              label="Ground"
              items={materialsFor('ground')}
              value={scene.terrain.groundMaterial.id}
              onPick={(id) => editor.execute(setGround({ id }))}
            />
          </Section>
          <Section title="File">
            <FileActions onDone={() => setOpen(false)} />
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
