import { detectRooms, loopSignature, orientedBox } from '@hd/geometry';
import { DEFAULT_MATERIAL_ROOF, DEFAULT_ROOF_OVERHANG_M, DEFAULT_ROOF_PITCH_DEG, newId, type Id, type Roof, type Scene, type Vec2 } from '@hd/scene-schema';
import type { Command } from '../types';
import { isHouseWall } from './walls';
import { centreLine } from '../roofSync';

export const ROOF_MIN_PITCH_DEG = 5;
export const ROOF_MAX_PITCH_DEG = 60;
export const ROOF_MAX_OVERHANG_M = 1.5;

export interface RoofInput {
  /** 'none' removes the roof. */
  style?: Roof['style'] | 'none';
  pitchDeg?: number;
  overhang?: number;
  materialId?: string;
  /** Ridge along the short side. */
  swap?: boolean;
  thickness?: number;
  rake?: number;
  ridgeCap?: boolean;
  gutter?: boolean;
  chimney?: boolean;
  parapet?: number;
  trim?: string;
  gableMaterialId?: string;
  /** Replaces the whole list of dormers. */
  dormers?: NonNullable<Roof['dormers']>;
  /** Flat roofs: terrace railing ('none' removes it). */
  railing?: NonNullable<Roof['railing']>;
  /** Fine tuning of the railing: fields given are merged into the current ones; `null` goes back to the plain look. */
  railingOpts?: Partial<NonNullable<Roof['railingOpts']>> | null;
}

/** Id of the old-style roof of a floor (one roof over the whole floor). */
export const roofIdFor = (levelId: Id): string => `roof_${levelId}`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Apply the shared settings to a roof (clamped); `undefined` fields are left alone. */
function applyProps(roof: Roof, input: RoofInput): void {
  if (input.style && input.style !== 'none') roof.style = input.style;
  if (input.pitchDeg !== undefined) roof.pitchDeg = clamp(input.pitchDeg, ROOF_MIN_PITCH_DEG, ROOF_MAX_PITCH_DEG);
  if (input.overhang !== undefined) roof.overhang = clamp(input.overhang, 0, ROOF_MAX_OVERHANG_M);
  if (input.materialId) roof.material = { id: input.materialId };
  if (input.swap !== undefined) {
    if (input.swap) roof.ridgeAngle = Math.PI / 2;
    else delete roof.ridgeAngle;
  }
  if (input.thickness !== undefined) roof.thickness = clamp(input.thickness, 0.05, 0.4);
  if (input.rake !== undefined) roof.rake = clamp(input.rake, 0, ROOF_MAX_OVERHANG_M);
  if (input.ridgeCap !== undefined) roof.ridgeCap = input.ridgeCap;
  if (input.gutter !== undefined) roof.gutter = input.gutter;
  if (input.chimney !== undefined) roof.chimney = input.chimney;
  if (input.parapet !== undefined) roof.parapet = clamp(input.parapet, 0, 0.9);
  if (input.trim !== undefined) roof.trim = input.trim;
  if (input.gableMaterialId) roof.gable = { id: input.gableMaterialId };
  if (input.railing) {
    if (input.railing === 'none') {
      delete roof.railing;
      delete roof.railingOpts;
    } else roof.railing = input.railing;
  }
  if (input.railingOpts === null) delete roof.railingOpts;
  else if (input.railingOpts) {
    const merged = { ...(roof.railingOpts ?? {}), ...input.railingOpts } as Record<string, unknown>;
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
    if (Object.keys(merged).length) roof.railingOpts = merged as NonNullable<Roof['railingOpts']>;
    else delete roof.railingOpts;
  }
  if (input.dormers) {
    const list = input.dormers.slice(0, 8).map((d) => ({ pos: clamp(d.pos, -1, 1), side: d.side >= 0 ? (1 as const) : (-1 as const), width: clamp(d.width, 0.6, 3) }));
    if (list.length) roof.dormers = list;
    else delete roof.dormers;
  }
}

/** Make a roof's floor keep its remaining automatic roofs as they are (the automatic mode is switched off for it). */
function freezeLevel(d: Scene, levelId: Id): void {
  const level = d.levels[levelId];
  if (level) level.autoRoof = false;
  for (const r of Object.values(d.roofs)) if (r.levelId === levelId && r.auto) r.auto = false;
}

/**
 * Create, change or remove the old-style roof of a floor (one roof over the whole floor). Unspecified fields keep their
 * value (or the defaults for a new roof); the first style given when none exists creates a gable roof by default.
 * New homes get automatic roofs instead (see `updateRoofs`, `setAutoRoofs`).
 */
export function setRoof(levelId: Id, input: RoofInput): Command {
  return {
    type: 'SetRoof',
    label: input.style === 'none' ? 'Remove roof' : 'Edit roof',
    apply(d) {
      if (!d.levels[levelId]) return;
      const id = roofIdFor(levelId);
      if (input.style === 'none') {
        // Every roof of the floor goes, and the floor stops growing new ones by itself.
        for (const [rid, r] of Object.entries(d.roofs)) if (r.levelId === levelId) delete d.roofs[rid];
        d.levels[levelId]!.autoRoof = false;
        return;
      }
      const cur = d.roofs[id];
      const roof: Roof = cur
        ? { ...cur }
        : {
            id,
            levelId,
            style: 'gable',
            pitchDeg: DEFAULT_ROOF_PITCH_DEG,
            overhang: DEFAULT_ROOF_OVERHANG_M,
            material: { id: DEFAULT_MATERIAL_ROOF },
          };
      applyProps(roof, input);
      d.roofs[id] = roof;
    },
  };
}

/** Change the settings of any roofs (one undo step). */
export function updateRoofs(ids: readonly Id[], input: RoofInput): Command {
  return {
    type: 'UpdateRoofs',
    label: 'Edit roof',
    apply(d) {
      for (const id of ids) {
        const r = d.roofs[id];
        if (r) applyProps(r, input);
      }
    },
  };
}

/** Copy one roof's look (style, slope, overhang, material and trim) to every other roof of its floor. */
export function matchRoofsOnFloor(roofId: Id): Command {
  return {
    type: 'MatchRoofs',
    label: 'Same roof everywhere on this floor',
    apply(d) {
      const src = d.roofs[roofId];
      if (!src) return;
      for (const r of Object.values(d.roofs)) {
        if (r.levelId !== src.levelId || r.id === src.id) continue;
        r.style = src.style;
        r.pitchDeg = src.pitchDeg;
        r.overhang = src.overhang;
        r.material = { ...src.material };
        for (const k of ['thickness', 'rake', 'ridgeCap', 'gutter', 'parapet', 'trim', 'railing', 'railingOpts'] as const) {
          if (src[k] === undefined) delete r[k];
          else (r as Record<string, unknown>)[k] = src[k];
        }
        if (src.gable) r.gable = { ...src.gable };
        else delete r.gable;
      }
    },
  };
}

/** Delete roofs. An automatic roof that goes switches its floor to hand-made roofs, so it does not grow back. */
export function removeRoofs(ids: readonly Id[]): Command {
  return {
    type: 'RemoveRoofs',
    label: ids.length > 1 ? 'Delete roofs' : 'Delete roof',
    apply(d) {
      const levels = new Set<Id>();
      for (const id of ids) {
        const r = d.roofs[id];
        if (r?.auto) levels.add(r.levelId);
      }
      for (const lid of levels) freezeLevel(d, lid);
      for (const id of ids) delete d.roofs[id];
    },
  };
}

/** Switch a floor between automatic roofs (one for every part of its rooms) and hand-made ones. */
export function setAutoRoofs(levelId: Id, on: boolean): Command {
  return {
    type: 'SetAutoRoofs',
    label: on ? 'Automatic roofs' : 'Hand-made roofs',
    apply(d) {
      const level = d.levels[levelId];
      if (!level) return;
      if (on) {
        // Old-style whole-floor roofs and frozen parts make way; hand-made parts stay.
        for (const [id, r] of Object.entries(d.roofs)) if (r.levelId === levelId && !r.box) delete d.roofs[id];
        level.autoRoof = true;
      } else freezeLevel(d, levelId);
    },
  };
}

/** Throw away every roof of the floor and let the automatic ones start again from the rooms. */
export function resetRoofs(levelId: Id): Command {
  return {
    type: 'ResetRoofs',
    label: 'Rebuild roofs',
    apply(d) {
      const level = d.levels[levelId];
      if (!level) return;
      for (const [id, r] of Object.entries(d.roofs)) if (r.levelId === levelId) delete d.roofs[id];
      level.autoRoof = true;
    },
  };
}

/** Room outlines (wall centre lines) of the given rooms. */
function outlinesOf(d: Scene, roomIds: readonly Id[]): { levelId: Id; polys: Vec2[][] } | null {
  const rooms = roomIds.map((id) => d.rooms[id]).filter((r): r is NonNullable<typeof r> => !!r);
  const first = rooms[0];
  if (!first) return null;
  const same = rooms.filter((r) => r.levelId === first.levelId);
  const walls = Object.values(d.walls).filter((w) => w.levelId === first.levelId && isHouseWall(w));
  const detected = detectRooms(d.nodes, walls);
  const polys = same.flatMap((r) => {
    const sig = loopSignature(r.wallLoop);
    const hit = detected.find((x) => x.signature === sig);
    const c = hit ? centreLine(d, hit.wallLoop) : null;
    return c ? [c] : [];
  });
  return polys.length ? { levelId: first.levelId, polys } : null;
}

/**
 * A roof of its own over the selected room(s): its own style, slope and material. The automatic roof of the floor leaves that
 * area alone and carries on over the rest.
 */
export function addRoofOverRooms(roomIds: readonly Id[], input: RoofInput = {}, rng?: () => number): Command & { roofId: Id } {
  const id = newId('roof', rng);
  return {
    type: 'AddRoofOverRooms',
    label: 'Roof over room',
    roofId: id,
    apply(d) {
      const o = outlinesOf(d, roomIds);
      if (!o) return;
      const box = orientedBox(o.polys.flat());
      if (!box) return;
      // Start from the look of the roofs already on the floor.
      const nearby = Object.values(d.roofs).find((r) => r.levelId === o.levelId);
      const roof: Roof = {
        id,
        levelId: o.levelId,
        style: nearby?.style ?? 'gable',
        pitchDeg: nearby?.pitchDeg ?? DEFAULT_ROOF_PITCH_DEG,
        overhang: nearby?.overhang ?? DEFAULT_ROOF_OVERHANG_M,
        material: { ...(nearby?.material ?? { id: DEFAULT_MATERIAL_ROOF }) },
        box,
      };
      applyProps(roof, input);
      d.roofs[id] = roof;
    },
  };
}
