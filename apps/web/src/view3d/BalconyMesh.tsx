import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Balcony, Scene, Vec2 } from '@hd/scene-schema';
import { balconyRailings, wallSegments } from '@hd/editor-core';
import { BALCONY_RAIL_HEIGHT_M, BALCONY_SLAB_M, buildFloorMesh, buildRailFromPaths, edgesAgainstWalls, railPathsFromSegments, type Segment } from '@hd/geometry';
import { FloorMesh } from './FloorMesh';
import { railGeometry, railMaterialsFor, railOptionsFor } from './railing';
import type { Tier } from './qualityLogic';
import { pickProps } from './pick';

export const DEFAULT_SLAB_COLOR = '#cfcac0';
const DEFAULT_CANOPY_FLAT = '#e8e4da';
const DEFAULT_CANOPY_PERGOLA = '#8a5a3c';

const std = (color: string, roughness = 0.85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide });

/** Extrude a flat outline between two heights (top and bottom faces plus a band round the edge). */
function extrude(outline: readonly Vec2[], bottom: number, top: number): THREE.BufferGeometry {
  const under = buildFloorMesh(outline, bottom, 'down');
  const over = buildFloorMesh(outline, top, 'up');
  const pos = Array.from(under.positions);
  const idx = Array.from(under.indices);
  const add = (m: { positions: Float32Array; indices: Uint32Array }) => {
    const base = pos.length / 3;
    pos.push(...m.positions);
    for (const i of m.indices) idx.push(base + i);
  };
  add(over);
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % n]!;
    const base = pos.length / 3;
    pos.push(a[0], bottom, a[1], b[0], bottom, b[1], b[0], top, b[1], a[0], top, a[1]);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const centroid = (p: readonly Vec2[]): Vec2 => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];

/** Slab: underside, edge band and top edge (the walking surface is the floor mesh). */
function SlabBody({ balcony, elevation }: { balcony: Balcony; elevation: number }) {
  const thickness = balcony.slab?.thickness ?? BALCONY_SLAB_M;
  const color = balcony.slab?.edgeColor ?? DEFAULT_SLAB_COLOR;
  const key = balcony.outline.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';');
  const geo = useMemo(() => extrude(balcony.outline, elevation - thickness, elevation), [key, elevation, thickness]); // eslint-disable-line react-hooks/exhaustive-deps
  const mat = useMemo(() => std(color, 0.9), [color]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <mesh geometry={geo} material={mat} castShadow receiveShadow {...pickProps(balcony.id, balcony.levelId)} />;
}

/** Railing along the open edges, through the same builder as stairs and roofs. */
function Railing({ balcony, runs, elevation }: { balcony: Balcony; runs: Segment[]; elevation: number }) {
  const kind = balcony.railing;
  const optsKey = JSON.stringify([kind, balcony.railingOpts]) + runs.map((r) => `${r.a[0].toFixed(3)},${r.a[1].toFixed(3)},${r.b[0].toFixed(3)},${r.b[1].toFixed(3)}`).join(';');
  const geo = useMemo(() => {
    if (kind === 'none' || runs.length === 0) return null;
    const o = railOptionsFor(kind, balcony.railingOpts, { height: BALCONY_RAIL_HEIGHT_M, spacing: 1.2, ...(kind === 'wall' ? { handrail: 'wide' as const } : {}) });
    const m = buildRailFromPaths(railPathsFromSegments(runs, 0), o);
    return m ? railGeometry(m) : null;
  }, [optsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const mats = useMemo(() => railMaterialsFor(kind, balcony.railingOpts), [kind, JSON.stringify(balcony.railingOpts)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo?.dispose(), [geo]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  if (!geo) return null;
  return <mesh geometry={geo} material={mats} position={[0, elevation, 0]} castShadow receiveShadow raycast={() => null} />;
}

/** Everything that stands on or hangs under the slab besides the railing: lip, columns, brackets, wall, canopy. */
function Extras({ balcony, against, elevation }: { balcony: Balcony; against: boolean[]; elevation: number }) {
  const o = balcony.outline;
  const n = o.length;
  const thickness = balcony.slab?.thickness ?? BALCONY_SLAB_M;
  const bottom = elevation - thickness;
  const c = centroid(o);
  const lip = balcony.slab?.lip ?? 0;
  const sup = balcony.supports?.kind ?? 'none';
  const size = balcony.supports?.size ?? (sup === 'brackets' ? 0.4 : 0.2);
  const supColor = balcony.supports?.color ?? DEFAULT_SLAB_COLOR;
  const canopy = balcony.canopy?.kind ?? 'none';
  const canopyH = balcony.canopy?.height ?? 2.7;
  const canopyColor = balcony.canopy?.color ?? (canopy === 'pergola' ? DEFAULT_CANOPY_PERGOLA : DEFAULT_CANOPY_FLAT);
  const key = JSON.stringify([o, against, elevation, balcony.slab, balcony.supports, balcony.canopy]);

  const supMat = useMemo(() => std(supColor, 0.8, supColor === '#2b2b2b' ? 0.6 : 0), [supColor]);
  const canMat = useMemo(() => std(canopyColor, canopy === 'pergola' ? 0.6 : 0.85), [canopyColor, canopy]);
  const lipMat = useMemo(() => std(balcony.slab?.edgeColor ?? DEFAULT_SLAB_COLOR, 0.9), [balcony.slab?.edgeColor]);
  useEffect(() => () => supMat.dispose(), [supMat]);
  useEffect(() => () => canMat.dispose(), [canMat]);
  useEffect(() => () => lipMat.dispose(), [lipMat]);

  const parts = useMemo(() => {
    const out: Array<{ pos: [number, number, number]; size: [number, number, number]; rotY: number; tilt?: number; mat: 'sup' | 'can' | 'lip' }> = [];
    const open = (i: number) => !against[i];
    const edge = (i: number) => {
      const a = o[i]!;
      const b = o[(i + 1) % n]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Vec2, ang: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) };
    };
    const inward = (p: Vec2, d: number): Vec2 => {
      const l = Math.hypot(c[0] - p[0], c[1] - p[1]) || 1;
      return [p[0] + ((c[0] - p[0]) / l) * d, p[1] + ((c[1] - p[1]) / l) * d];
    };
    const groundGap = bottom; // room under the slab down to the ground
    // low kerb round the open edges
    if (lip > 0.005) {
      for (let i = 0; i < n; i++) {
        if (!open(i)) continue;
        const e = edge(i);
        out.push({ pos: [e.mid[0], elevation + lip / 2, e.mid[1]], size: [e.len, lip, 0.08], rotY: e.ang, mat: 'lip' });
      }
    }
    // columns at the open corners
    const cornerOpen = (i: number) => open(i) || open((i + n - 1) % n);
    if (sup === 'columns' && groundGap > 0.2) {
      for (let i = 0; i < n; i++) {
        if (!cornerOpen(i)) continue;
        const p = inward(o[i]!, size * 0.7);
        out.push({ pos: [p[0], groundGap / 2, p[1]], size: [size, groundGap, size], rotY: 0, mat: 'sup' });
      }
    }
    // a wall under each open edge
    if (sup === 'wall' && groundGap > 0.2) {
      for (let i = 0; i < n; i++) {
        if (!open(i)) continue;
        const e = edge(i);
        const m = inward(e.mid, Math.min(0.1 + size / 2, 0.4));
        out.push({ pos: [m[0], groundGap / 2, m[1]], size: [e.len, groundGap, Math.max(0.1, Math.min(size, 0.4))], rotY: e.ang, mat: 'sup' });
      }
    }
    // brackets: a gusset under the slab on the house wall, every metre
    if (sup === 'brackets') {
      for (let i = 0; i < n; i++) {
        if (open(i)) continue;
        const e = edge(i);
        const count = Math.max(2, Math.round(e.len / 1.0));
        const dx = (e.b[0] - e.a[0]) / e.len;
        const dz = (e.b[1] - e.a[1]) / e.len;
        for (let k = 0; k < count; k++) {
          const t = ((k + 0.5) / count) * e.len;
          const base: Vec2 = [e.a[0] + dx * t, e.a[1] + dz * t];
          const tip = inward(base, size / 2);
          // a diagonal strut: low on the wall, out to the slab underside. The box's own z points across the edge: lean it toward the balcony.
          const zdir: Vec2 = [-dz, dx];
          const lean = (tip[0] - base[0]) * zdir[0] + (tip[1] - base[1]) * zdir[1] >= 0 ? 1 : -1;
          out.push({ pos: [tip[0], bottom - size / 2 + 0.02, tip[1]], size: [0.08, Math.hypot(size, size), 0.06], rotY: e.ang, tilt: (lean * Math.PI) / 4, mat: 'sup' });
        }
      }
    }
    return out;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // canopy slab / pergola
  const canopyGeo = useMemo(() => (canopy === 'flat' ? extrude(o, elevation + canopyH, elevation + canopyH + 0.1) : null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => canopyGeo?.dispose(), [canopyGeo]);
  const slats = useMemo(() => {
    if (canopy !== 'pergola') return [];
    const xs = o.map((p) => p[0]);
    const zs = o.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    const alongX = x1 - x0 >= z1 - z0; // beams run along the longer side, slats across it
    const out: Array<{ pos: [number, number, number]; size: [number, number, number] }> = [];
    const y = elevation + canopyH + 0.06;
    const lo = alongX ? x0 : z0;
    const hi = alongX ? x1 : z1;
    for (let t = lo + 0.12; t < hi - 0.05; t += 0.24) {
      // where the line across the balcony at t is inside the outline
      const hits: number[] = [];
      for (let i = 0; i < n; i++) {
        const a = o[i]!;
        const b = o[(i + 1) % n]!;
        const ta = alongX ? a[0] : a[1];
        const tb = alongX ? b[0] : b[1];
        if (ta === tb || (t - ta) * (t - tb) > 0) continue;
        const f = (t - ta) / (tb - ta);
        hits.push(alongX ? a[1] + (b[1] - a[1]) * f : a[0] + (b[0] - a[0]) * f);
      }
      hits.sort((p, q) => p - q);
      for (let k = 0; k + 1 < hits.length; k += 2) {
        const s0 = hits[k]!;
        const s1 = hits[k + 1]!;
        const len = s1 - s0 + 0.2;
        out.push(alongX ? { pos: [t, y, (s0 + s1) / 2], size: [0.06, 0.1, len] } : { pos: [(s0 + s1) / 2, y, t], size: [len, 0.1, 0.06] });
      }
    }
    // two beams under the slats along the open sides
    const beam = (cx: number, cz: number, w: number, d: number) => out.push({ pos: [cx, elevation + canopyH, cz], size: [w, 0.14, d] });
    if (alongX) {
      beam((x0 + x1) / 2, z0 + 0.05, x1 - x0 + 0.2, 0.1);
      beam((x0 + x1) / 2, z1 - 0.05, x1 - x0 + 0.2, 0.1);
    } else {
      beam(x0 + 0.05, (z0 + z1) / 2, 0.1, z1 - z0 + 0.2);
      beam(x1 - 0.05, (z0 + z1) / 2, 0.1, z1 - z0 + 0.2);
    }
    return out;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // posts holding the cover up, at the open corners
  const posts = useMemo(() => {
    if (canopy === 'none') return [];
    const out: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      if (!(!against[i] || !against[(i + n - 1) % n])) continue;
      const l = Math.hypot(c[0] - o[i]![0], c[1] - o[i]![1]) || 1;
      out.push([o[i]![0] + ((c[0] - o[i]![0]) / l) * 0.1, o[i]![1] + ((c[1] - o[i]![1]) / l) * 0.1]);
    }
    return out;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const matOf = (m: 'sup' | 'can' | 'lip') => (m === 'sup' ? supMat : m === 'lip' ? lipMat : canMat);
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} position={p.pos} rotation={new THREE.Euler(p.tilt ?? 0, p.rotY, 0, 'YXZ')} material={matOf(p.mat)} castShadow receiveShadow raycast={() => null}>
          <boxGeometry args={p.size} />
        </mesh>
      ))}
      {canopyGeo && <mesh geometry={canopyGeo} material={canMat} castShadow receiveShadow raycast={() => null} />}
      {slats.map((s, i) => (
        <mesh key={`s${i}`} position={s.pos} material={canMat} castShadow raycast={() => null}>
          <boxGeometry args={s.size} />
        </mesh>
      ))}
      {posts.map((p, i) => (
        <mesh key={`p${i}`} position={[p[0], elevation + canopyH / 2, p[1]]} material={supMat} castShadow raycast={() => null}>
          <boxGeometry args={[0.1, canopyH, 0.1]} />
        </mesh>
      ))}
    </group>
  );
}

/** One balcony / porch: floor on top, slab body below, railings along the open edges, supports and a cover when chosen. */
export function BalconyMesh({ balcony, scene, elevation, tier }: { balcony: Balcony; scene: Scene; elevation: number; tier: Tier }) {
  const runs = balconyRailings(scene, balcony.id);
  const against = edgesAgainstWalls(balcony.outline, wallSegments(scene, balcony.levelId));
  return (
    <group>
      <FloorMesh polygon={balcony.outline} elevation={elevation} materialId={balcony.floorMaterial.id} tier={tier} roomId={balcony.id} levelId={balcony.levelId} />
      <SlabBody balcony={balcony} elevation={elevation} />
      <Railing balcony={balcony} runs={runs} elevation={elevation} />
      <Extras balcony={balcony} against={against} elevation={elevation} />
    </group>
  );
}
