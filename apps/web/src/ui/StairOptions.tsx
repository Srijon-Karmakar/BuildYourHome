import { useEffect, useRef, useState } from 'react';
import { MAX_STAIR_FLIGHTS } from '@hd/editor-core';
import { useUi, type NewStairSettings } from '../plan/session';
import { LengthField, Segmented, Toggle } from './fields';
import { PopClose } from './PopClose';
import { EXIT_OPTIONS } from './StairExitPanel';

const BUILDS: Array<{ id: NewStairSettings['build']; label: string }> = [
  { id: 'solid', label: 'Solid' },
  { id: 'stringer', label: 'Side beams' },
  { id: 'spine', label: 'Centre spine' },
  { id: 'floating', label: 'Floating' },
];

const RAILINGS: Array<{ id: NewStairSettings['railing']; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'wood', label: 'Wood' },
  { id: 'metal', label: 'Metal' },
  { id: 'glass', label: 'Glass' },
];

/** "Up N floors" stepper: how many floors one click of the Stairs tool connects. */
export function StairFloorsStepper() {
  const flights = useUi((s) => s.newStair.flights);
  const set = useUi((s) => s.setNewStair);
  return (
    <div className="stair-steps" role="group" aria-label="Floors to connect">
      <button type="button" className="pill small" aria-label="One floor fewer" disabled={flights <= 1} onClick={() => set({ flights: flights - 1 })}>
        −
      </button>
      <span className="stair-steps-n" aria-live="polite" title="The stairs climb this many floors; missing floors are added">
        Up {flights} {flights === 1 ? 'floor' : 'floors'}
      </span>
      <button type="button" className="pill small" aria-label="One floor more" disabled={flights >= MAX_STAIR_FLIGHTS} onClick={() => set({ flights: flights + 1 })}>
        +
      </button>
    </div>
  );
}

/** The Stairs tool's settings card: floors, room round the top, width, build, railing, height of added floors. */
export function StairOptions() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const ns = useUi((s) => s.newStair);
  const set = useUi((s) => s.setNewStair);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={root} className="stair-options" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="pill small" aria-expanded={open} title="Floors, room, width, build and railing of the next stairs" onClick={() => setOpen((o) => !o)}>
        Stair options
      </button>
      {open && (
        <div className="popover above" role="group" aria-label="New stairs">
          <PopClose onClick={() => setOpen(false)} />
          <h4>New stairs · up {ns.flights} {ns.flights === 1 ? 'floor' : 'floors'}</h4>
          <Toggle
            label="Room above"
            hint={ns.hall ? 'Walls, a landing and a door round the top on each floor' : 'Off: just the stairs, no walls or roof'}
            checked={ns.hall}
            onChange={(hall) => set({ hall })}
          />
          <LengthField label="Width" value={ns.width} min={0.6} max={3} step={0.05} onCommit={(width) => set({ width })} />
          <Segmented label="Build" value={ns.build} options={BUILDS} onChange={(build) => set({ build })} />
          <Segmented label="Railing" value={ns.railing} options={RAILINGS} onChange={(railing) => set({ railing })} />
          <Segmented label="Exit at the top" value={ns.exit} options={EXIT_OPTIONS} onChange={(exit) => set({ exit })} />
          <LengthField
            label="New floor height"
            hint="Used for floors the stairs add"
            value={ns.floorHeight ?? 3}
            min={2}
            max={6}
            step={0.1}
            onCommit={(floorHeight) => set({ floorHeight })}
          />
          <button type="button" className="pill small" onClick={() => set({ hall: false, flights: 1, width: 1, build: 'solid', railing: 'wood', floorHeight: null, exit: 'none' })}>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
