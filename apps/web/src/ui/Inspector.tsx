import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { getAsset, CATEGORIES } from '@hd/assets';
import type { Roof, Zone, Balcony, Item, Opening, Room, RoomType, Stair, Wall } from '@hd/scene-schema';
import { DOOR_STYLES, FRAME_COLORS, LEAF_COLORS, WINDOW_STYLES } from '@hd/scene-schema';
import { SHADE_COLORS, SHADE_STYLES, defaultShadeDepth, type ShadeStyle } from '../view3d/sunshade';
import { RoofPanel } from './RoofPanel';
import { isTree, TreeSize } from './TreeSize';
import { StairRailPanel } from './StairRailPanel';
import { StairExitPanel } from './StairExitPanel';
import { StairBuildPanel } from './StairBuildPanel';
import { BalconyPanel } from './BalconyPanel';
import { RoadPanel } from './RoadPanel';
import { useEnvPanelVisible } from './EnvironmentPanel';
import { addRoofOverRooms, connectStairHall, isHouseWall, continueStairUp, levelAbove, batch, updateZones, duplicateItems, layoutOf, rotateItems, rotateStairs, stairNeedsRoom, stairProblems, updateStairs, setItemsProps, setOpeningProps, setRoomProps, setWallsProps } from '@hd/editor-core';
import { formatArea, formatLength } from '../lib/units';
import { requireAccess } from '../cloud/store';
import { deleteSelection } from '../plan/PlanController';
import { facesFor } from '../plan/wallFaces';
import { levelRooms } from '../plan/rooms';
import { editor, useUi } from '../plan/session';
import { GlassWallPanel } from './GlassWallPanel';
import { catalogMaterial, finishMaterials, materialsFor, paintMaterials } from '../view3d/placeholderMaterials';
import { AngleField, Chips, ColorSwatches, LengthField, Section, SelectField, Segmented, Swatches, TextField, Toggle } from './fields';

const ROOM_TYPES: Array<{ id: RoomType; label: string }> = [
  { id: 'living', label: 'Living room' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'dining', label: 'Dining' },
  { id: 'study', label: 'Study' },
  { id: 'hall', label: 'Hall' },
  { id: 'balcony', label: 'Balcony' },
  { id: 'utility', label: 'Utility' },
  { id: 'garage', label: 'Garage' },
  { id: 'other', label: 'Other' },
];

const THICKNESS_PRESETS = [
  { label: '10 cm', value: 0.1 },
  { label: '11.5 cm', value: 0.115 },
  { label: '15 cm', value: 0.15 },
  { label: '23 cm', value: 0.23 },
];

const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 699px)').matches;

/** The value shared by every item, or null when they differ ("mixed"). */
function common<T>(values: readonly T[], eq: (a: T, b: T) => boolean = (a, b) => a === b): T | null {
  const first = values[0];
  if (first === undefined) return null;
  return values.every((v) => eq(v, first)) ? first : null;
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The style an opening shows when none was chosen (matches the 3D fixture defaults). */
const effectiveStyle = (o: Opening) => o.style ?? (o.type === 'door' ? 'flush' : o.type === 'window' ? (o.width > 1 ? 'double' : 'single') : 'none');
const openingName = (o: Opening) => (o.type === 'arch' ? 'Archway' : o.type === 'window' ? 'Window' : 'Door');

/**
 * Property panel for the current selection (docs/DESIGN.md: floating, quiet, only when there is something to edit).
 * Edits are single undoable commands; with several items selected, one edit applies to all of them.
 */
export function Inspector() {
  const walk = useUi((s) => s.walk);
  const viewOnly = useUi((s) => s.viewOnly);
  const envOpen = useEnvPanelVisible(); // the environment editor takes this spot while it is open
  const additive = useUi((s) => s.additive);
  const toggleAdditive = useUi((s) => s.toggleAdditive);
  const paintSide = useUi((s) => s.paintSide);
  const setPaintSide = useUi((s) => s.setPaintSide);
  const scene = useStore(editor.store, (s) => s.scene);
  const selection = useStore(editor.store, (s) => s.selection);
  const levelId = useStore(editor.store, (s) => s.activeLevelId);
  const [collapsed, setCollapsed] = useState(isPhone);
  const empty = selection.length === 0;

  // The floating bar's Edit button: open the card (it starts collapsed on phones).
  useEffect(() => {
    const open = () => setCollapsed(false);
    window.addEventListener('hd:edit', open);
    return () => window.removeEventListener('hd:edit', open);
  }, []);

  // Tell the stylesheet when the card is expanded (the floating bar steps aside on phones).
  useEffect(() => {
    const open = !empty && !viewOnly && !walk && !collapsed;
    if (open) document.documentElement.dataset.insOpen = '1';
    else delete document.documentElement.dataset.insOpen;
    return () => {
      delete document.documentElement.dataset.insOpen;
    };
  }, [empty, viewOnly, walk, collapsed]);

  // On phones the panel starts as a slim bar; reset that whenever the selection is cleared.
  useEffect(() => {
    if (empty) setCollapsed(isPhone());
  }, [empty]);

  const { walls, openings, rooms, items, stairs, balconies, zones, roofs } = useMemo(() => {
    const rf: Roof[] = [];
    const zn: Zone[] = [];
    const it: Item[] = [];
    const bl: Balcony[] = [];
    const st: Stair[] = [];
    const w: Wall[] = [];
    const o: Opening[] = [];
    const r: Room[] = [];
    for (const id of selection) {
      if (scene.walls[id]) w.push(scene.walls[id]!);
      else if (scene.openings[id]) o.push(scene.openings[id]!);
      else if (scene.rooms[id]) r.push(scene.rooms[id]!);
      else if (scene.items[id]) it.push(scene.items[id]!);
      else if (scene.stairs[id]) st.push(scene.stairs[id]!);
      else if (scene.balconies[id]) bl.push(scene.balconies[id]!);
      else if (scene.zones[id]) zn.push(scene.zones[id]!);
      else if (scene.roofs[id]) rf.push(scene.roofs[id]!);
    }
    return { walls: w, openings: o, rooms: r, items: it, stairs: st, balconies: bl, zones: zn, roofs: rf };
  }, [selection, scene]);

  if (walk || empty || viewOnly || envOpen) return null;

  // ------------------------------------------------------------------ header
  const total = walls.length + openings.length + rooms.length + items.length + stairs.length + balconies.length + zones.length + roofs.length;
  let title: string;
  let subtitle = '';
  if (total === 1 && rooms[0]) {
    title = rooms[0].name;
    const a = levelRooms(scene, levelId).find((r) => r.room?.id === rooms[0]!.id)?.area;
    subtitle = a ? formatArea(a, scene.meta.units) : 'Room';
  } else if (total === 1 && walls[0]) {
    const w = walls[0];
    const a = scene.nodes[w.a]?.p;
    const b = scene.nodes[w.b]?.p;
    title = 'Wall';
    subtitle = a && b ? `${formatLength(Math.hypot(b[0] - a[0], b[1] - a[1]), scene.meta.units)} long` : '';
  } else if (total === 1 && items[0]) {
    const asset = getAsset(items[0].assetId);
    title = asset?.name ?? 'Item';
    subtitle = asset ? `${CATEGORIES.find((c) => c.id === asset.category)?.name ?? ''} · ${formatLength(asset.size[0] * items[0].scale[0], scene.meta.units)} × ${formatLength(asset.size[1] * items[0].scale[2], scene.meta.units)}` : '';
  } else if (total === 1 && roofs[0]) {
    title = 'Roof';
    subtitle = `${scene.levels[roofs[0].levelId]?.name ?? ''} · ${roofs[0].style}`;
  } else if (total === 1 && zones[0]) {
    title = zones[0].shape === 'road' ? 'Road' : zones[0].shape === 'path' ? 'Path' : 'Garden area';
    subtitle = catalogMaterial(zones[0].material.id).name;
  } else if (total === 1 && balconies[0]) {
    title = 'Balcony';
    subtitle = `${scene.levels[balconies[0].levelId]?.name ?? ''}`;
  } else if (total === 1 && stairs[0]) {
    const s = stairs[0];
    const l = layoutOf(scene, s);
    title = 'Stairs';
    subtitle = `${scene.levels[s.fromLevel]?.name ?? ''} → ${scene.levels[s.toLevel]?.name ?? ''}${l ? ` · ${formatLength(l.rise, scene.meta.units)} up · ${l.risers} steps` : ''}`;
  } else if (total === 1 && openings[0]) {
    title = openingName(openings[0]);
    subtitle = `${formatLength(openings[0].width, scene.meta.units)} × ${formatLength(openings[0].height, scene.meta.units)}`;
  } else {
    title = plural(total, 'item');
    subtitle = [walls.length && plural(walls.length, 'wall'), openings.length && plural(openings.length, 'opening'), rooms.length && plural(rooms.length, 'room'), items.length && plural(items.length, 'furnishing'), stairs.length && plural(stairs.length, 'stairs')]
      .filter(Boolean)
      .join(' · ');
  }

  // ----------------------------------------------------------------- edits
  const wallIds = walls.map((w) => w.id);
  const editWalls = (props: Parameters<typeof setWallsProps>[1]) => editor.execute(setWallsProps(wallIds, props));
  const editRooms = (props: Parameters<typeof setRoomProps>[1]) =>
    editor.execute(batch(rooms.length > 1 ? 'Edit rooms' : 'Edit room', rooms.map((r) => setRoomProps(r.id, props))));
  const editOpenings = (props: Parameters<typeof setOpeningProps>[1]) =>
    editor.execute(batch(openings.length > 1 ? 'Edit openings' : 'Edit opening', openings.map((o) => setOpeningProps(o.id, props))));

  const faceIds = walls.flatMap((w) => facesFor(scene, w, paintSide).map((f) => (f === 'a' ? w.materialA.id : w.materialB.id)));
  const faceValue = common(faceIds);
  const paintWalls = (id: string) =>
    editor.execute(
      batch(
        'Paint walls',
        walls.map((w) => {
          const f = facesFor(scene, w, paintSide);
          return setWallsProps([w.id], { ...(f.includes('a') ? { materialA: { id } } : {}), ...(f.includes('b') ? { materialB: { id } } : {}) });
        }),
      ),
    );
  const oneType = openings.length > 0 && openings.every((o) => o.type === openings[0]!.type) ? openings[0]!.type : null;

  const itemIds = items.map((i) => i.id);
  const sameAsset = items.length > 0 && items.every((i) => i.assetId === items[0]!.assetId) ? getAsset(items[0]!.assetId) : undefined;
  const editItems = (props: Parameters<typeof setItemsProps>[1]) => editor.execute(setItemsProps(itemIds, props));
  const SCALE_PRESETS = [
    { label: '75 %', value: 0.75 },
    { label: '100 %', value: 1 },
    { label: '125 %', value: 1.25 },
    { label: '150 %', value: 1.5 },
  ];

  const stairIds = stairs.map((s) => s.id);
  const editStairs = (props: Parameters<typeof updateStairs>[1]) => editor.execute(updateStairs(stairIds, props));
  const stairRooms = (lid: string) => levelRooms(scene, lid).map((r) => r.polygon);
  const missingRoom = stairs.length === 1 ? stairNeedsRoom(scene, stairs[0]!, stairRooms) : null;
  // Stairs on their own (nothing built on the floor above yet) are a choice, not a mistake: offer the room, don't warn.
  const standalone = missingRoom !== null && !Object.values(scene.walls).some((w) => w.levelId === missingRoom && isHouseWall(w));
  const needsRoom = standalone ? null : missingRoom;
  const zoneIds = zones.map((z) => z.id);
  const editZones = (props: Parameters<typeof updateZones>[1]) => editor.execute(updateZones(zoneIds, props));
  const canDelete = walls.length + openings.length + items.length + stairs.length + balconies.length + zones.length + roofs.length > 0;

  return (
    <aside className={`inspector${collapsed ? ' collapsed' : ''}`} aria-label="Properties">
      <header>
        <button type="button" className="ins-title" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </button>
        <div className="ins-actions">
          <button
            type="button"
            className="pill small"
            title="Tap more items to add them to the selection"
            aria-pressed={additive}
            onClick={toggleAdditive}
          >
            Add more
          </button>
          <button type="button" className="ins-close" title="Clear selection (Esc)" aria-label="Clear selection" onClick={() => editor.select([])}>
            ×
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="ins-body">
          {rooms.length > 0 && (
            <Section title={rooms.length > 1 ? 'Rooms' : 'Room'}>
              {rooms.length === 1 && <TextField label="Name" value={rooms[0]!.name} onCommit={(name) => editRooms({ name })} />}
              <SelectField
                label="Type"
                value={common(rooms.map((r) => r.type)) ?? 'other'}
                options={ROOM_TYPES}
                onChange={(type) => editRooms({ type })}
              />
              <Swatches
                label="Floor"
                items={materialsFor('floor')}
                value={common(rooms.map((r) => r.floorMaterial.id))}
                onPick={(id) => editRooms({ floorMaterial: { id } })}
              />
              <Toggle
                label="Ceiling"
                hint="Shown when you walk through"
                checked={rooms.every((r) => r.hasCeiling)}
                onChange={(hasCeiling) => editRooms({ hasCeiling })}
              />
              {rooms.every((r) => r.levelId === rooms[0]!.levelId) && (
                <button
                  type="button"
                  className="pill small"
                  title="Give this room (or these rooms) a roof of its own, with its own shape and material"
                  onClick={() => {
                    const cmd = addRoofOverRooms(rooms.map((r) => r.id));
                    editor.execute(cmd);
                    if (editor.getState().scene.roofs[cmd.roofId]) editor.select([cmd.roofId]);
                  }}
                >
                  Own roof for {rooms.length > 1 ? 'these rooms' : 'this room'}
                </button>
              )}
              {rooms.every((r) => r.hasCeiling) && (
                <Swatches
                  label="Ceiling paint"
                  items={paintMaterials()}
                  value={common(rooms.map((r) => r.ceilingMaterial?.id ?? 'paint-white'))}
                  onPick={(id) => editRooms({ ceilingMaterial: { id } })}
                />
              )}
            </Section>
          )}

          {walls.length > 0 && (
            <Section title={walls.length > 1 ? 'Walls' : 'Wall'}>
              <LengthField
                label="Thickness"
                value={common(walls.map((w) => w.thickness), near)}
                min={0.05}
                max={1}
                step={0.005}
                onCommit={(thickness) => editWalls({ thickness })}
              />
              <Chips
                items={THICKNESS_PRESETS}
                current={common(walls.map((w) => w.thickness), near)}
                onPick={(thickness) => editWalls({ thickness })}
              />
              <LengthField
                label="Height"
                value={common(walls.map((w) => w.height), near)}
                min={1}
                max={10}
                onCommit={(height) => editWalls({ height })}
              />
              <Segmented
                label="Kind"
                value={common(walls.map((w) => w.kind))}
                options={[
                  { id: 'interior', label: 'Inside' },
                  { id: 'exterior', label: 'Outside' },
                ]}
                onChange={(kind) => editWalls({ kind })}
              />
              <Segmented
                label="Surface"
                value={paintSide}
                options={[
                  { id: 'both', label: 'Both sides' },
                  { id: 'interior', label: 'Interior wall' },
                  { id: 'exterior', label: 'Exterior wall' },
                ]}
                onChange={setPaintSide}
              />
              {paintSide !== 'both' && <p className="f-note">The brick line on the plan shows the face you are painting: the side that looks into a room (interior) or outside (exterior).</p>}
              <Swatches label="Paint" items={paintMaterials()} value={faceValue} onPick={paintWalls} />
              <Swatches label="Finish" items={finishMaterials()} value={faceValue} onPick={paintWalls} />
              {walls.every((w) => w.kind !== 'fence' && w.kind !== 'boundary') && <GlassWallPanel walls={walls} />}
            </Section>
          )}

          {items.length > 0 && (
            <Section title={items.length > 1 ? 'Furniture' : 'Item'}>
              {sameAsset?.colors && (
                <ColorSwatches
                  label="Colour"
                  items={sameAsset.colors}
                  value={common(items.map((i) => i.variant ?? sameAsset.colors![0]!.id))}
                  onPick={(variant) => editItems({ variant })}
                />
              )}
              <AngleField
                label="Rotation"
                value={common(items.map((i) => (i.rotationY * 180) / Math.PI), near)}
                onCommit={(deg) => editItems({ rotationY: (deg * Math.PI) / 180 })}
              />
              <div className="f-chips">
                <button type="button" onClick={() => editor.execute(rotateItems(itemIds, -Math.PI / 2))}>
                  ↺ 90°
                </button>
                <button type="button" onClick={() => editor.execute(rotateItems(itemIds, Math.PI / 2))}>
                  ↻ 90°
                </button>
              </div>
              {items.every((i) => isTree(i.assetId)) && sameAsset ? (
                <TreeSize items={items} />
              ) : (
                <>
                  <div className="f-label" style={{ margin: '6px 0 6px' }}>
                    Size
                  </div>
                  <Chips items={SCALE_PRESETS} current={common(items.map((i) => i.scale[0]), near)} onPick={(scale) => editItems({ scale })} />
                </>
              )}
              <Toggle label="Lock in place" hint="Stops it being moved by accident" checked={items.every((i) => i.locked)} onChange={(locked) => editItems({ locked })} />
              <div className="ins-footer" style={{ paddingTop: 4 }}>
                <button type="button" className="pill" title="Copy (Ctrl+D)" onClick={() => requireAccess(items.map((i) => i.assetId), 'copy') && editor.execute(duplicateItems(itemIds))}>
                  Duplicate
                </button>
              </div>
            </Section>
          )}

          {roofs.length > 0 && <RoofPanel roofs={roofs} />}

          {zones.some((z) => z.shape === 'road') && <RoadPanel roads={zones.filter((z) => z.shape === 'road')} />}

          {zones.some((z) => z.shape !== 'road') && (
            <Section title={zones.filter((z) => z.shape !== 'road').every((z) => z.shape === 'path') ? 'Path' : 'Garden area'}>
              <Swatches
                label="Surface"
                items={materialsFor('ground')}
                value={common(zones.map((z) => z.material.id))}
                onPick={(id) => editZones({ material: { id } })}
              />
              {zones.every((z) => z.shape === 'path') && (
                <LengthField label="Width" value={common(zones.map((z) => z.width ?? 1), near)} min={0.3} max={6} step={0.1} onCommit={(width) => editZones({ width })} />
              )}
            </Section>
          )}

          {balconies.length > 0 && (
            <Section title="Balcony">
              <BalconyPanel balconies={balconies} />
            </Section>
          )}

          {stairs.length > 0 && (
            <Section title={stairs.length > 1 ? 'Stairs' : 'Stairs'}>
              <Segmented
                label="Shape"
                value={common(stairs.map((s) => s.kind))}
                options={[
                  { id: 'straight', label: 'Straight' },
                  { id: 'L', label: 'L-shape' },
                  { id: 'U', label: 'U-shape' },
                  { id: 'spiral', label: 'Spiral' },
                ]}
                onChange={(kind) => editStairs({ kind })}
              />
              {stairs.some((s) => s.kind !== 'straight') && (
                <Segmented
                  label="Turns"
                  value={common(stairs.map((s) => (s.mirror ? 'right' : 'left')))}
                  options={[
                    { id: 'left', label: 'Left' },
                    { id: 'right', label: 'Right' },
                  ]}
                  onChange={(t) => editStairs({ mirror: t === 'right' })}
                />
              )}
              <LengthField label="Width" value={common(stairs.map((s) => s.width), near)} min={0.6} max={3} step={0.05} onCommit={(width) => editStairs({ width })} />
              <div className="f-chips">
                <button type="button" onClick={() => editor.execute(rotateStairs(stairIds, -Math.PI / 2))}>
                  ↺ 90°
                </button>
                <button type="button" onClick={() => editor.execute(rotateStairs(stairIds, Math.PI / 2))}>
                  ↻ 90°
                </button>
              </div>
              <StairBuildPanel stairs={stairs} />
              <Segmented
                label="Railing"
                value={common(stairs.map((s) => s.railing ?? 'none'))}
                options={[
                  { id: 'none', label: 'None' },
                  { id: 'wood', label: 'Wood' },
                  { id: 'metal', label: 'Metal' },
                  { id: 'glass', label: 'Glass' },
                ]}
                onChange={(railing) => editStairs({ railing })}
              />
              {stairs.some((st) => st.railing && st.railing !== 'none') && <StairRailPanel stairs={stairs} />}
              <StairExitPanel stairs={stairs} />
              <Swatches
                label="Steps"
                items={materialsFor('floor')}
                value={common(stairs.map((s) => s.material?.id ?? 'floor-wood-walnut'))}
                onPick={(id) => editStairs({ material: { id } })}
              />
              {stairs.length === 1 && stairProblems(scene, stairs[0]!).map((msg) => (
                <p key={msg} className="f-note" role="status" data-testid="stair-problem">
                  {msg}
                </p>
              ))}
              {needsRoom && (
                <>
                  <p className="f-note" role="status" data-testid="stair-warning">
                    The floor can only open where there is a room: draw walls around the top of the stairs on {scene.levels[needsRoom]?.name ?? 'the floor above'}, or let me build them.
                  </p>
                  <button type="button" className="pill small solid" onClick={() => editor.execute(connectStairHall(stairs[0]!.id))}>
                    Build the room above
                  </button>
                </>
              )}
              {standalone && (
                <>
                  <p className="f-note" role="status" data-testid="stair-standalone">
                    These stairs stand on their own: nothing is built on {scene.levels[missingRoom!]?.name ?? 'the floor above'} yet.
                  </p>
                  <button type="button" className="pill small" onClick={() => editor.execute(connectStairHall(stairs[0]!.id))}>
                    Build a room above
                  </button>
                </>
              )}
              {stairs.length === 1 && !needsRoom && !Object.values(scene.stairs).some((o) => o.fromLevel === stairs[0]!.toLevel) && (
                <button type="button" className="pill small" title="Add a matching flight from this stair's top floor to the next one (adds the floor if needed)" onClick={() => editor.execute(continueStairUp(stairs[0]!.id, undefined, { hall: !standalone }))}>
                  {levelAbove(scene, stairs[0]!.toLevel) ? 'Continue stairs up' : 'Continue stairs up (adds a floor)'}
                </button>
              )}
            </Section>
          )}

          {openings.length > 0 && (
            <Section title={openings.length > 1 ? 'Openings' : openingName(openings[0]!)}>
              <LengthField
                label="Width"
                value={common(openings.map((o) => o.width), near)}
                min={0.3}
                max={6}
                onCommit={(width) => editOpenings({ width })}
              />
              <LengthField
                label="Height"
                value={common(openings.map((o) => o.height), near)}
                min={0.3}
                max={4}
                onCommit={(height) => editOpenings({ height })}
              />
              <LengthField
                label="Sill"
                hint="Height above floor"
                value={common(openings.map((o) => o.sill), near)}
                max={3}
                disabled={openings.every((o) => o.type !== 'window')}
                onCommit={(sill) => editOpenings({ sill })}
              />
              {(oneType === 'door' || oneType === 'window') && (
                <Segmented
                  label="Style"
                  value={common(openings.map(effectiveStyle))}
                  options={(oneType === 'door' ? DOOR_STYLES : WINDOW_STYLES).map((s) => ({ id: s as string, label: cap(s) }))}
                  onChange={(style) =>
                    // Double, French and sliding doors need room for two leaves.
                    editOpenings(['double', 'french', 'sliding'].includes(style) && oneType === 'door' ? { style, width: Math.max(1.4, ...openings.map((o) => o.width)) } : { style })
                  }
                />
              )}
              {oneType !== 'arch' && oneType !== null && (
                <ColorSwatches
                  label="Frame colour"
                  items={FRAME_COLORS}
                  value={common(openings.map((o) => o.frameColor ?? FRAME_COLORS[0].id))}
                  onPick={(frameColor) => editOpenings({ frameColor })}
                />
              )}
              {oneType === 'door' && (
                <ColorSwatches
                  label="Door colour"
                  items={LEAF_COLORS}
                  value={common(openings.map((o) => o.leafColor ?? LEAF_COLORS[0].id))}
                  onPick={(leafColor) => editOpenings({ leafColor })}
                />
              )}
              {oneType !== 'arch' && oneType !== null && (
                <>
                  <Segmented
                    label="Sunshade"
                    value={common(openings.map((o) => o.shade?.style ?? 'none')) ?? 'none'}
                    options={[{ id: 'none', label: 'None' }, ...SHADE_STYLES.filter((x) => x.id !== 'canopy' || oneType === 'door').map((x) => ({ id: x.id as string, label: x.label }))]}
                    onChange={(id) => editOpenings(id === 'none' ? { shade: null } : { shade: { style: id as ShadeStyle, depth: defaultShadeDepth(id as ShadeStyle) } })}
                  />
                  {openings.every((o) => o.shade) && (
                    <>
                      <LengthField
                        label="Sunshade depth"
                        value={common(openings.map((o) => o.shade!.depth), near)}
                        min={0.15}
                        max={2}
                        onCommit={(depth) => editOpenings({ shade: { depth } })}
                      />
                      <ColorSwatches
                        label="Sunshade colour"
                        items={SHADE_COLORS}
                        value={common(openings.map((o) => o.shade!.color ?? SHADE_COLORS[0]!.id))}
                        onPick={(color) => editOpenings({ shade: { color } })}
                      />
                    </>
                  )}
                </>
              )}
              {openings.every((o) => o.type === 'door') && (
                <>
                  <Toggle
                    label="Opens to the other side"
                    checked={openings.every((o) => o.flip.swing)}
                    onChange={(swing) => editOpenings({ flip: { swing } })}
                  />
                  <Toggle
                    label="Hinge on the other side"
                    checked={openings.every((o) => o.flip.side)}
                    onChange={(side) => editOpenings({ flip: { side } })}
                  />
                </>
              )}
            </Section>
          )}

          {canDelete && (
            <div className="ins-footer">
              <button type="button" className="pill" onClick={deleteSelection}>
                Delete {total > 1 ? 'selected' : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
