import {
  DEFAULT_MATERIAL_WALL,
  WALL_THICKNESS_EXTERIOR_M,
  WALL_THICKNESS_INTERIOR_M,
  newId,
  type Id,
  type Scene,
  type Vec2,
  type Wall,
  type WallPanel,
} from '@hd/scene-schema';
import type { Command } from '../types';

/** Plain deep copy of wall dressing data (works on Immer drafts too). */
const copy = <T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** Panel seen from the other end of the wall: the axis runs the other way and the faces swap. */
const flipPanel = (p: WallPanel, len: number): WallPanel => ({ ...copy(p), offset: len - p.offset, side: p.side === 'A' ? 'B' : 'A' });

/** Two walls can merge only when their dressing matches (faces swapped when one of them is reversed). */
function sameDressing(w1: Wall, rev1: boolean, w2: Wall, rev2: boolean): boolean {
  const lowers = (w: Wall, rev: boolean) => JSON.stringify(rev ? [w.lowerB, w.lowerA] : [w.lowerA, w.lowerB]);
  return lowers(w1, rev1) === lowers(w2, rev2) && JSON.stringify(w1.trim) === JSON.stringify(w2.trim) && JSON.stringify(w1.glazed) === JSON.stringify(w2.glazed);
}

/** Points closer than this (metres) on the same level are treated as the same node. */
export const NODE_MERGE_EPS_M = 1e-3;

function findNodeAt(d: Scene, levelId: Id, p: Vec2): Id | undefined {
  for (const n of Object.values(d.nodes)) {
    if (n.levelId === levelId && Math.hypot(n.p[0] - p[0], n.p[1] - p[1]) < NODE_MERGE_EPS_M) {
      return n.id;
    }
  }
  return undefined;
}

/** A garden fence: thin, low, wooden; drawn with the wall tool but never part of the house (no rooms, no roof). */
export const FENCE_STYLE = { thickness: 0.06, height: 1.2, material: 'wall-wood-panel' } as const;

/** Walls that belong to the house (rooms, roofs and the plot check look at these only). */
export const isHouseWall = (w: { kind: Wall['kind'] }): boolean => w.kind !== 'boundary' && w.kind !== 'fence';

export interface AddWallParams {
  levelId: Id;
  from: Vec2;
  to: Vec2;
  kind?: Wall['kind'];
  thickness?: number;
  height?: number;
}

const EPS = NODE_MERGE_EPS_M;

/** Projection of p onto segment a→b: parameter t (0..1 inside) and distance to the infinite-clamped segment. */
function project(p: Vec2, a: Vec2, b: Vec2): { t: number; dist: number } {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  const t = len2 === 0 ? 0 : ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2;
  const c = Math.max(0, Math.min(1, t));
  return { t, dist: Math.hypot(p[0] - (a[0] + abx * c), p[1] - (a[1] + abz * c)) };
}

/** Intersection of segments a→b and c→d as parameters (t on ab, u on cd); null when parallel. */
function intersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): { t: number; u: number } | null {
  const rx = b[0] - a[0], rz = b[1] - a[1];
  const sx = d[0] - c[0], sz = d[1] - c[1];
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qx = c[0] - a[0], qz = c[1] - a[1];
  return { t: (qx * sz - qz * sx) / den, u: (qx * rz - qz * rx) / den };
}

function uniqueId(taken: (id: string) => boolean, stem: string): string {
  let id = stem;
  for (let k = 1; taken(id); k++) id = `${stem}.${k}`;
  return id;
}

/** Split every wall of the level whose BODY (not an endpoint) passes through node `nodeId`. */
function splitWallsAtNode(d: Scene, levelId: Id, nodeId: Id, stem: string): void {
  const node = d.nodes[nodeId];
  if (!node) return;
  for (const w of Object.values(d.walls)) {
    if (w.levelId !== levelId || w.a === nodeId || w.b === nodeId) continue;
    const a = d.nodes[w.a];
    const b = d.nodes[w.b];
    if (!a || !b) continue;
    const { dist } = project(node.p, a.p, b.p);
    if (dist >= EPS) continue;
    const distA = Math.hypot(node.p[0] - a.p[0], node.p[1] - a.p[1]);
    const distB = Math.hypot(node.p[0] - b.p[0], node.p[1] - b.p[1]);
    if (distA < EPS || distB < EPS) continue;

    // Second half keeps all properties; the first half keeps the original id (selection stays valid).
    const secondId = uniqueId((x) => x in d.walls, `${stem}~${w.id}`);
    d.walls[secondId] = {
      ...w,
      id: secondId,
      a: nodeId,
      b: w.b,
      materialA: { ...w.materialA },
      materialB: { ...w.materialB },
      lowerA: copy(w.lowerA),
      lowerB: copy(w.lowerB),
      trim: copy(w.trim),
      panels: undefined,
    };
    // Feature panels follow their position; one that crosses the split is cut in two.
    if (w.panels?.length) {
      const first: WallPanel[] = [];
      const second: WallPanel[] = [];
      for (const p of w.panels) {
        const s0 = p.offset - p.width / 2;
        const s1 = p.offset + p.width / 2;
        if (s1 <= distA + 1e-6) first.push(copy(p));
        else if (s0 >= distA - 1e-6) second.push({ ...copy(p), offset: p.offset - distA });
        else {
          first.push({ ...copy(p), offset: (s0 + distA) / 2, width: distA - s0 });
          second.push({ ...copy(p), id: `${p.id}~2`, offset: (s1 - distA) / 2, width: s1 - distA });
        }
      }
      w.panels = first.length ? first : undefined;
      if (second.length) d.walls[secondId]!.panels = second;
    }
    for (const k of ['lowerA', 'lowerB', 'trim', 'panels'] as const) if (d.walls[secondId]![k] === undefined) delete d.walls[secondId]![k];
    if (w.panels === undefined) delete w.panels;
    w.b = nodeId;
    // Openings beyond the split move to the second half.
    for (const o of Object.values(d.openings)) {
      if (o.wallId === w.id && o.offset > distA) {
        o.wallId = secondId;
        o.offset -= distA;
      }
    }
  }
}

/**
 * Adds a wall. The new wall is cut wherever it touches or crosses the plan:
 *  - existing nodes on its body become joints,
 *  - existing walls it crosses are split at the crossing (X junction),
 *  - existing walls whose body its endpoints land on are split (T junction).
 * Coincident points reuse nodes, so loops close automatically. One undo step covers all splits.
 */
export function addWall(params: AddWallParams, rng?: () => number): Command {
  const base = newId('wall', rng);
  return {
    type: 'AddWall',
    label: 'Add wall',
    apply(d) {
      const { levelId, from: A, to: B } = params;
      const level = d.levels[levelId];
      if (!level) return;
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (len < EPS) return;

      // 1. Cut points along the new wall (parameter t, plan position).
      const cuts: Array<{ t: number; p: Vec2 }> = [
        { t: 0, p: A },
        { t: 1, p: B },
      ];
      for (const n of Object.values(d.nodes)) {
        if (n.levelId !== levelId) continue;
        const { t, dist } = project(n.p, A, B);
        if (dist < EPS && t * len > EPS && (1 - t) * len > EPS) cuts.push({ t, p: n.p });
      }
      for (const w of Object.values(d.walls)) {
        if (w.levelId !== levelId) continue;
        const a = d.nodes[w.a];
        const b = d.nodes[w.b];
        if (!a || !b) continue;
        const hit = intersect(A, B, a.p, b.p);
        if (!hit) continue;
        const wlen = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
        if (hit.t * len > EPS && (1 - hit.t) * len > EPS && hit.u * wlen > EPS && (1 - hit.u) * wlen > EPS) {
          cuts.push({ t: hit.t, p: [A[0] + (B[0] - A[0]) * hit.t, A[1] + (B[1] - A[1]) * hit.t] });
        }
      }
      cuts.sort((x, y) => x.t - y.t);

      // 2. Resolve cut points to nodes (reuse or create) and split walls whose body they touch.
      const chain: Id[] = [];
      cuts.forEach((c, i) => {
        let nid = findNodeAt(d, levelId, c.p);
        if (!nid) {
          nid = uniqueId((x) => x in d.nodes, `${base}~n${i}`);
          d.nodes[nid] = { id: nid, levelId, p: [c.p[0], c.p[1]] };
        }
        if (chain[chain.length - 1] === nid) return;
        chain.push(nid);
        splitWallsAtNode(d, levelId, nid, base);
      });

      // 3. Lay the new wall as one segment between consecutive joints.
      const kind = params.kind ?? 'interior';
      const thickness =
        params.thickness ??
        (kind === 'fence'
          ? FENCE_STYLE.thickness
          : kind === 'interior'
          ? (d.defaults?.interiorThickness ?? WALL_THICKNESS_INTERIOR_M)
          : (d.defaults?.exteriorThickness ?? WALL_THICKNESS_EXTERIOR_M));
      for (let i = 0; i + 1 < chain.length; i++) {
        const a = chain[i]!;
        const b = chain[i + 1]!;
        const dup = Object.values(d.walls).some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
        if (dup) continue;
        const id = uniqueId((x) => x in d.walls, i === 0 ? base : `${base}~${i}`);
        d.walls[id] = {
          id,
          levelId,
          a,
          b,
          kind,
          thickness,
          height: params.height ?? (kind === 'fence' ? FENCE_STYLE.height : level.height),
          materialA: { id: kind === 'fence' ? FENCE_STYLE.material : DEFAULT_MATERIAL_WALL },
          materialB: { id: kind === 'fence' ? FENCE_STYLE.material : DEFAULT_MATERIAL_WALL },
        };
      }
    },
  };
}

export function moveNode(nodeId: Id, p: Vec2): Command {
  return {
    type: 'MoveNode',
    label: 'Move wall point',
    apply(d) {
      const n = d.nodes[nodeId];
      if (n) n.p = [p[0], p[1]];
    },
  };
}

/** Largest sine of the angle between two wall directions that still counts as "in a straight line". */
const COLLINEAR_SIN = 1e-4;

/**
 * Heal straight joints: a node left with exactly two walls that continue in a straight line, with identical
 * properties, is dissolved and the two walls become one (the first wall keeps its id). Openings move
 * across with corrected offsets (and mirrored swing/hinge when a wall's direction had to be reversed).
 * Called after deleting walls, so removing a divider restores the wall it had split.
 */
export function mergeCollinearAt(d: Scene, nodeIds: Iterable<Id>): void {
  for (const nid of nodeIds) {
    const n = d.nodes[nid];
    if (!n) continue;
    const inc = Object.values(d.walls).filter((w) => w.a === nid || w.b === nid);
    if (inc.length !== 2) continue;
    const [w1, w2] = inc as [Wall, Wall];
    const o1 = w1.a === nid ? w1.b : w1.a; // far ends
    const o2 = w2.a === nid ? w2.b : w2.a;
    const n1 = d.nodes[o1];
    const n2 = d.nodes[o2];
    if (!n1 || !n2 || o1 === o2) continue;

    const v1: Vec2 = [n1.p[0] - n.p[0], n1.p[1] - n.p[1]];
    const v2: Vec2 = [n2.p[0] - n.p[0], n2.p[1] - n.p[1]];
    const len1 = Math.hypot(v1[0], v1[1]);
    const len2 = Math.hypot(v2[0], v2[1]);
    if (len1 < 1e-6 || len2 < 1e-6) continue;
    const sin = Math.abs(v1[0] * v2[1] - v1[1] * v2[0]) / (len1 * len2);
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    if (sin > COLLINEAR_SIN || dot >= 0) continue; // not straight through the node

    // New wall runs o1 → o2. w1 is reversed if it ran n → o1; w2 is reversed if it ran o2 → n.
    const rev1 = w1.a === nid;
    const rev2 = w2.b === nid;
    const faces = (w: Wall, rev: boolean) => (rev ? [w.materialB.id, w.materialA.id] : [w.materialA.id, w.materialB.id]);
    const f1 = faces(w1, rev1);
    const f2 = faces(w2, rev2);
    if (
      w1.thickness !== w2.thickness ||
      w1.height !== w2.height ||
      w1.kind !== w2.kind ||
      w1.levelId !== w2.levelId ||
      f1[0] !== f2[0] ||
      f1[1] !== f2[1] ||
      !sameDressing(w1, rev1, w2, rev2)
    ) {
      continue;
    }

    // Feature panels of both walls end up on w1, measured along the merged wall o1 -> o2.
    const panels: WallPanel[] = [
      ...(w1.panels ?? []).map((p) => (rev1 ? flipPanel(p, len1) : copy(p))),
      ...(w2.panels ?? []).map((p) => {
        const q = rev2 ? flipPanel(p, len2) : copy(p);
        return { ...q, offset: len1 + q.offset };
      }),
    ];
    if (rev1) {
      const lower = w1.lowerA;
      if (w1.lowerB) w1.lowerA = w1.lowerB;
      else delete w1.lowerA;
      if (lower) w1.lowerB = lower;
      else delete w1.lowerB;
    }
    if (panels.length) w1.panels = panels;
    else delete w1.panels;

    for (const o of Object.values(d.openings)) {
      if (o.wallId === w1.id) {
        o.offset = rev1 ? len1 - o.offset : o.offset;
        if (rev1) o.flip = { swing: !o.flip.swing, side: !o.flip.side };
      } else if (o.wallId === w2.id) {
        o.offset = len1 + (rev2 ? len2 - o.offset : o.offset);
        if (rev2) o.flip = { swing: !o.flip.swing, side: !o.flip.side };
        o.wallId = w1.id;
      }
    }
    if (rev1) {
      const a = w1.materialA;
      w1.materialA = w1.materialB;
      w1.materialB = a;
    }
    w1.a = o1;
    w1.b = o2;
    delete d.walls[w2.id];
    delete d.nodes[nid];
  }
}

export function removeWalls(wallIds: Id[]): Command {
  return {
    type: 'RemoveWalls',
    label: wallIds.length > 1 ? 'Delete walls' : 'Delete wall',
    apply(d) {
      const touched = new Set<Id>();
      for (const id of wallIds) {
        const w = d.walls[id];
        if (w) {
          touched.add(w.a);
          touched.add(w.b);
        }
        delete d.walls[id];
      }
      // Re-join walls that a deleted wall had been splitting. (postProcess removes orphan nodes etc.)
      mergeCollinearAt(d, touched);
    },
  };
}

export type WallProps = Partial<Pick<Wall, 'thickness' | 'height' | 'kind' | 'materialA' | 'materialB'>> & {
  /** Two-tone lower finish per face (merged; a material is needed to create it); `null` removes it. */
  lowerA?: Partial<NonNullable<Wall['lowerA']>> | null;
  lowerB?: Partial<NonNullable<Wall['lowerB']>> | null;
  /** Mouldings on the outside face (merged); `null` removes them. */
  trim?: Partial<NonNullable<Wall['trim']>> | null;
  /** Full glass wall: fields given are merged (`{}` turns it on with the defaults); `null` makes the wall solid again. */
  glazed?: Partial<NonNullable<Wall['glazed']>> | null;
};

/** Default height of a new two-tone lower finish (m). */
export const LOWER_HEIGHT_M = 1;

export function setWallProps(wallId: Id, props: WallProps): Command {
  return setWallsProps([wallId], props);
}

/** Edit several walls at once (one undo step). Thickness/height are clamped to sane limits. */
export function setWallsProps(wallIds: readonly Id[], props: WallProps): Command {
  return {
    type: 'SetWallProps',
    label: wallIds.length > 1 ? 'Edit walls' : 'Edit wall',
    apply(d) {
      const { lowerA, lowerB, trim, glazed, ...p } = props;
      if (p.thickness !== undefined) p.thickness = Math.min(1, Math.max(0.05, p.thickness));
      if (p.height !== undefined) p.height = Math.min(10, Math.max(1, p.height));
      for (const id of wallIds) {
        const w = d.walls[id];
        if (!w) continue;
        Object.assign(w, p);
        // A material object must never be shared between two walls.
        if (p.materialA) w.materialA = { ...p.materialA };
        if (p.materialB) w.materialB = { ...p.materialB };
        for (const [key, val] of [['lowerA', lowerA], ['lowerB', lowerB]] as const) {
          if (val === null) delete w[key];
          else if (val) {
            const cur = w[key];
            const material = val.material ?? cur?.material;
            if (!material) continue;
            const height = Math.min(w.height - 0.1, Math.max(0.1, val.height ?? cur?.height ?? LOWER_HEIGHT_M));
            const next = { ...copy(cur), ...copy(val), material: { ...material }, height };
            if (val.band === '') delete next.band;
            w[key] = next;
          }
        }
        if (trim === null) delete w.trim;
        else if (trim) {
          const next = { ...copy(w.trim), ...copy(trim) };
          if (next.bands) next.bands = next.bands.filter((h) => h > 0.1 && h < w.height).slice(0, 4);
          if (next.size !== undefined) next.size = Math.min(2, Math.max(0.5, next.size));
          if (!next.cornice && !next.plinth && !next.pilasters && !next.bands?.length) delete w.trim;
          else w.trim = next;
        }
        if (glazed === null) delete w.glazed;
        else if (glazed) {
          const next = { ...(w.glazed ?? {}), ...glazed };
          for (const k of Object.keys(next) as Array<keyof typeof next>) if (next[k] === undefined) delete next[k];
          if (next.transom === 0) delete next.transom;
          w.glazed = next;
        }
      }
    },
  };
}

/** Fields of a feature panel that can be edited. */
export type WallPanelProps = Partial<Omit<WallPanel, 'id'>>;

/** Keep a panel on its wall: inside the wall length and height. */
function fitPanel(p: WallPanel, len: number, wallH: number): WallPanel {
  const width = Math.min(Math.max(0.1, p.width), len);
  const height = Math.min(Math.max(0.1, p.height), wallH);
  const bottom = Math.min(Math.max(0, p.bottom), wallH - height);
  const offset = Math.min(Math.max(width / 2, p.offset), len - width / 2);
  const out: WallPanel = { ...p, width, height, bottom, offset, material: { ...p.material } };
  if (out.depth !== undefined) out.depth = Math.min(0.15, Math.max(0.005, out.depth));
  return out;
}

const wallLength = (d: Scene, w: Wall): number => {
  const a = d.nodes[w.a]?.p;
  const b = d.nodes[w.b]?.p;
  return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
};

/** Add a feature panel to one face of a wall (ADR-030). Defaults: the middle third of the wall, floor to top. */
export function addWallPanel(wallId: Id, panel: WallPanelProps & Pick<WallPanel, 'side' | 'material'>, rng?: () => number): Command {
  const id = newId('panel', rng);
  return {
    type: 'AddWallPanel',
    label: 'Add feature panel',
    apply(d) {
      const w = d.walls[wallId];
      if (!w) return;
      const len = wallLength(d, w);
      if (len < 0.2) return;
      const base: WallPanel = { id, side: panel.side, material: panel.material, offset: len / 2, width: Math.max(0.6, len / 3), bottom: 0, height: w.height };
      const p = fitPanel({ ...base, ...copy(panel), id } as WallPanel, len, w.height);
      w.panels = [...(w.panels ?? []).map(copy), p].slice(-24);
    },
  };
}

/** Edit feature panels by id (any wall). */
export function updateWallPanels(panelIds: readonly Id[], props: WallPanelProps): Command {
  return {
    type: 'UpdateWallPanels',
    label: panelIds.length > 1 ? 'Edit panels' : 'Edit panel',
    apply(d) {
      for (const w of Object.values(d.walls)) {
        if (!w.panels?.some((p) => panelIds.includes(p.id))) continue;
        const len = wallLength(d, w);
        w.panels = w.panels.map((p) => (panelIds.includes(p.id) ? fitPanel({ ...copy(p), ...copy(props) } as WallPanel, len, w.height) : p));
      }
    },
  };
}

/** Delete feature panels by id. */
export function removeWallPanels(panelIds: readonly Id[]): Command {
  return {
    type: 'RemoveWallPanels',
    label: panelIds.length > 1 ? 'Delete panels' : 'Delete panel',
    apply(d) {
      for (const w of Object.values(d.walls)) {
        if (!w.panels?.some((p) => panelIds.includes(p.id))) continue;
        const rest = w.panels.filter((p) => !panelIds.includes(p.id));
        if (rest.length) w.panels = rest;
        else delete w.panels;
      }
    },
  };
}
