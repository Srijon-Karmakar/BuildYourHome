import { detectRooms, orientedBox, type OrientedBox } from '@hd/geometry';
import { DEFAULT_MATERIAL_ROOF, DEFAULT_ROOF_STYLE, DEFAULT_ROOF_OVERHANG_M, DEFAULT_ROOF_PITCH_DEG, type Id, type Roof, type Scene, type Vec2 } from '@hd/scene-schema';
import { isHouseWall } from './commands/walls';

/** Smallest roof part worth building (m): thinner slivers between rooms are covered by their neighbours' overhang. */
const MIN_PART_M = 0.8;
/** Plan coordinates closer than this count as the same grid line (m). */
const LINE_EPS = 0.02;
/** More parts than this and the home is probably not a simple block plan: fall back to one roof per room. */
const MAX_GRID_PARTS = 10;

export type RoofBox = OrientedBox;

const key = (n: number) => Math.round(n * 1000);

function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * The wall centre-line outline of a room (detected rooms report the inner floor outline, which is a wall thickness
 * smaller). Null for a loop that does not chain up.
 */
export function centreLine(d: Scene, wallLoop: readonly Id[]): Vec2[] | null {
  const ws = wallLoop.map((id) => d.walls[id]);
  if (ws.length < 3 || ws.some((w) => !w)) return null;
  const w0 = ws[0]!;
  const w1 = ws[1]!;
  let cur: Id = w1.a === w0.a || w1.b === w0.a ? w0.b : w0.a;
  const pts: Vec2[] = [];
  for (const w of ws) {
    const p = d.nodes[cur]?.p;
    if (!p || (w!.a !== cur && w!.b !== cur)) return null;
    pts.push([p[0], p[1]]);
    cur = w!.a === cur ? w!.b : w!.a;
  }
  return pts;
}

/** Room outlines (wall centre lines) of one floor. */
export function roomPolygons(d: Scene, levelId: Id): Vec2[][] {
  const walls = Object.values(d.walls).filter((w) => w.levelId === levelId && isHouseWall(w));
  if (walls.length < 3) return [];
  return detectRooms(d.nodes, walls).flatMap((r) => {
    const c = centreLine(d, r.wallLoop);
    return c ? [c] : [];
  });
}

const inPoly = (p: Vec2, poly: readonly Vec2[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

const inBox = (p: Vec2, b: RoofBox): boolean => {
  const dx = p[0] - b.cx;
  const dz = p[1] - b.cz;
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  return Math.abs(dx * c + dz * s) <= b.length / 2 && Math.abs(-dx * s + dz * c) <= b.width / 2;
};

/** Overlap area of two roof boxes, measured in the first one's frame (exact when their sides are parallel). */
function overlapArea(a: RoofBox, b: RoofBox): number {
  const c = Math.cos(a.angle);
  const s = Math.sin(a.angle);
  const to = (x: number, z: number): Vec2 => [(x - a.cx) * c + (z - a.cz) * s, -(x - a.cx) * s + (z - a.cz) * c];
  const cb = Math.cos(b.angle);
  const sb = Math.sin(b.angle);
  const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([i, j]) => to(b.cx + (i * b.length * cb) / 2 - (j * b.width * sb) / 2, b.cz + (i * b.length * sb) / 2 + (j * b.width * cb) / 2));
  const us = corners.map((p) => p[0]);
  const vs = corners.map((p) => p[1]);
  const w = Math.min(a.length / 2, Math.max(...us)) - Math.max(-a.length / 2, Math.min(...us));
  const h = Math.min(a.width / 2, Math.max(...vs)) - Math.max(-a.width / 2, Math.min(...vs));
  return w > 0 && h > 0 ? w * h : 0;
}

/** Direction (radians, 0..π/2) of the longest house wall of the floor: the roofs line up with it. */
function dominantAngle(d: Scene, levelId: Id): number {
  let best = 0;
  let bestLen = -1;
  for (const w of Object.values(d.walls)) {
    if (w.levelId !== levelId || !isHouseWall(w)) continue;
    const a = d.nodes[w.a]?.p;
    const b = d.nodes[w.b]?.p;
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > bestLen) {
      bestLen = len;
      best = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
  }
  const q = Math.PI / 2;
  return ((best % q) + q) % q;
}

const normalise = (uc: number, vc: number, du: number, dv: number, theta: number): RoofBox => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let angle = theta;
  let length = du;
  let width = dv;
  if (dv > du) {
    length = dv;
    width = du;
    angle += Math.PI / 2;
  }
  return { cx: uc * c - vc * s, cz: uc * s + vc * c, angle: Math.atan2(Math.sin(angle), Math.cos(angle)), length, width };
};

/**
 * The rectangles that need a roof on one floor: the floor's rooms, minus what the floor above covers, minus what a
 * hand-made roof already claims. A block plan (every room edge square to the longest wall) is cut into the fewest
 * rectangles on a grid of the rooms' own edges (an L-shaped house becomes two parts); anything else gets one box per room.
 */
export function roofParts(d: Scene, levelId: Id, manual: readonly RoofBox[]): RoofBox[] {
  const rooms = roomPolygons(d, levelId);
  if (rooms.length === 0) return [];
  const idx = d.levelOrder.indexOf(levelId);
  // Whatever any floor higher up covers needs no roof here (an empty floor in between does not count).
  const above = idx >= 0 ? d.levelOrder.slice(idx + 1).flatMap((l) => roomPolygons(d, l)) : [];
  const theta = dominantAngle(d, levelId);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const toUV = (p: Vec2): Vec2 => [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
  const fromUV = (u: number, v: number): Vec2 => [u * c - v * s, u * s + v * c];

  const square = rooms.every((poly) =>
    poly.every((p, i) => {
      const q = poly[(i + 1) % poly.length]!;
      const a = toUV(p);
      const b = toUV(q);
      return Math.abs(a[0] - b[0]) < 0.01 || Math.abs(a[1] - b[1]) < 0.01;
    }),
  );

  const covered = (p: Vec2): boolean => above.some((poly) => inPoly(p, poly)) || manual.some((b) => inBox(p, b));

  if (square) {
    const uv = rooms.map((poly) => poly.map(toUV));
    const gather = (k: 0 | 1): number[] => {
      const all = [...uv.flat().map((p) => p[k]), ...above.flatMap((poly) => poly.map((p) => toUV(p)[k])), ...manual.flatMap((b) => cornersOf(b).map((p) => toUV(p)[k]))].sort((x, y) => x - y);
      const out: number[] = [];
      for (const v of all) if (out.length === 0 || v - out[out.length - 1]! > LINE_EPS) out.push(v);
      return out;
    };
    const us = gather(0);
    const vs = gather(1);
    const filled = (i: number, j: number): boolean => {
      const uc = (us[i]! + us[i + 1]!) / 2;
      const vc = (vs[j]! + vs[j + 1]!) / 2;
      const w = fromUV(uc, vc);
      return rooms.some((poly) => inPoly(w, poly)) && !covered(w);
    };
    // Rows of runs, then runs that repeat in the next row are merged into one rectangle.
    type Run = { i0: number; i1: number; j0: number; j1: number };
    const open = new Map<string, Run>();
    const done: Run[] = [];
    for (let j = 0; j < vs.length - 1; j++) {
      const runs: Array<[number, number]> = [];
      let start = -1;
      for (let i = 0; i <= us.length - 1; i++) {
        const on = i < us.length - 1 && filled(i, j);
        if (on && start < 0) start = i;
        if (!on && start >= 0) {
          runs.push([start, i - 1]);
          start = -1;
        }
      }
      const next = new Map<string, Run>();
      for (const [i0, i1] of runs) {
        const k = `${i0}:${i1}`;
        const prev = open.get(k);
        if (prev) {
          prev.j1 = j;
          next.set(k, prev);
          open.delete(k);
        } else next.set(k, { i0, i1, j0: j, j1: j });
      }
      for (const r of open.values()) done.push(r);
      open.clear();
      for (const [k, r] of next) open.set(k, r);
    }
    for (const r of open.values()) done.push(r);
    const parts = done
      .map((r) => normalise((us[r.i0]! + us[r.i1 + 1]!) / 2, (vs[r.j0]! + vs[r.j1 + 1]!) / 2, us[r.i1 + 1]! - us[r.i0]!, vs[r.j1 + 1]! - vs[r.j0]!, theta))
      .filter((b) => b.width >= MIN_PART_M);
    if (parts.length <= MAX_GRID_PARTS) return parts;
  }

  // Anything else: one box per room that is not already covered.
  return rooms
    .filter((poly) => !covered([poly.reduce((x, p) => x + p[0], 0) / poly.length, poly.reduce((z, p) => z + p[1], 0) / poly.length]))
    .map((poly) => orientedBox(poly))
    .filter((b): b is RoofBox => !!b && b.width >= MIN_PART_M);
}

function cornersOf(b: RoofBox): Vec2[] {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([i, j]): Vec2 => [b.cx + (i * b.length * c) / 2 - (j * b.width * s) / 2, b.cz + (i * b.length * s) / 2 + (j * b.width * c) / 2]);
}

const sameBox = (a: RoofBox, b: RoofBox): boolean =>
  Math.abs(a.cx - b.cx) < 1e-4 && Math.abs(a.cz - b.cz) < 1e-4 && Math.abs(a.length - b.length) < 1e-4 && Math.abs(a.width - b.width) < 1e-4 && Math.abs(a.angle - b.angle) < 1e-4;

/** Settings a new roof part borrows from the biggest roof already on the floor, so a home keeps one roof look. */
function template(d: Scene, levelId: Id): Pick<Roof, 'style' | 'pitchDeg' | 'overhang' | 'material'> & Partial<Roof> {
  const onLevel = Object.values(d.roofs).filter((r) => r.levelId === levelId);
  const area = (r: Roof) => (r.box ? r.box.length * r.box.width : 0);
  const pick = [...onLevel].sort((a, b) => area(b) - area(a))[0];
  if (!pick) return { style: DEFAULT_ROOF_STYLE, pitchDeg: DEFAULT_ROOF_PITCH_DEG, overhang: DEFAULT_ROOF_OVERHANG_M, material: { id: DEFAULT_MATERIAL_ROOF } };
  const { style, pitchDeg, overhang, material, thickness, rake, ridgeCap, gutter, trim, gable, parapet, railing, railingOpts } = pick;
  return {
    style,
    pitchDeg,
    overhang,
    material: { ...material },
    ...(thickness !== undefined ? { thickness } : {}),
    ...(rake !== undefined ? { rake } : {}),
    ...(ridgeCap !== undefined ? { ridgeCap } : {}),
    ...(gutter !== undefined ? { gutter } : {}),
    ...(trim ? { trim } : {}),
    ...(gable ? { gable: { ...gable } } : {}),
    ...(parapet !== undefined ? { parapet } : {}),
    ...(railing ? { railing } : {}),
    ...(railingOpts ? { railingOpts: { ...railingOpts } } : {}),
  };
}

/**
 * Keep the automatic roofs in step with the plan. For every floor with `autoRoof` on (and no old-style whole-floor roof),
 * the roof parts that cover its rooms are created, moved or removed as walls change; a part that is still the same
 * part keeps its id and every setting the user chose. Hand-made roofs are never touched and their area is left alone.
 * Only writes on change.
 */
export function syncRoofs(d: Scene): void {
  for (const [id, r] of Object.entries(d.roofs)) if (!d.levels[r.levelId]) delete d.roofs[id];

  for (const levelId of d.levelOrder) {
    const level = d.levels[levelId];
    if (!level?.autoRoof) continue;
    const roofs = Object.values(d.roofs).filter((r) => r.levelId === levelId);
    if (roofs.some((r) => !r.box)) continue; // an old-style roof over the whole floor: leave the floor alone
    const manual = roofs.filter((r) => !r.auto && r.box).map((r) => r.box!);
    const parts = roofParts(d, levelId, manual);
    const autos = roofs.filter((r) => r.auto);

    // Match every wanted part to the existing automatic roof it overlaps most.
    const pairs: Array<{ part: number; roof: Roof; ov: number }> = [];
    parts.forEach((p, i) => {
      for (const r of autos) {
        const ov = overlapArea(p, r.box!);
        if (ov > 0.2 * Math.min(p.length * p.width, r.box!.length * r.box!.width)) pairs.push({ part: i, roof: r, ov });
      }
    });
    pairs.sort((a, b) => b.ov - a.ov);
    const usedPart = new Set<number>();
    const usedRoof = new Set<Id>();
    for (const m of pairs) {
      if (usedPart.has(m.part) || usedRoof.has(m.roof.id)) continue;
      usedPart.add(m.part);
      usedRoof.add(m.roof.id);
      const live = d.roofs[m.roof.id]!;
      const p = parts[m.part]!;
      if (!sameBox(live.box!, p)) live.box = { ...p };
    }
    for (const r of autos) if (!usedRoof.has(r.id)) delete d.roofs[r.id];
    const base = template(d, levelId);
    parts.forEach((p, i) => {
      if (usedPart.has(i)) return;
      let id = `roof_${hashId(`${levelId}|${key(p.cx)}|${key(p.cz)}|${key(p.length)}|${key(p.width)}`)}`;
      while (d.roofs[id]) id += 'x';
      d.roofs[id] = { id, levelId, ...base, box: { ...p }, auto: true };
    });
  }
}
