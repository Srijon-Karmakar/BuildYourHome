import { describe, expect, it } from 'vitest';
import { getAsset, itemFootprint } from '@hd/assets';
import { stairNeedsRoom } from '@hd/editor-core';
import { levelRoomsOf } from '../../../../packages/editor-core/src/testRooms';
import { parseSceneFile, serializeScene } from '../lib/persistence';
import { SAMPLES } from './samples';
import type { Vec2 } from '@hd/scene-schema';

/** Smallest push (m) that separates two convex polygons; 0 when they do not overlap. */
function penetration(a: Vec2[], b: Vec2[]): number {
  let min = Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const nx = -(q[1] - p[1]);
      const nz = q[0] - p[0];
      const len = Math.hypot(nx, nz) || 1;
      const proj = (pts: Vec2[]) => pts.map((v) => (v[0] * nx + v[1] * nz) / len);
      const pa = proj(a);
      const pb = proj(b);
      const overlap = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (overlap <= 0) return 0;
      min = Math.min(min, overlap);
    }
  }
  return min;
}

describe('sample homes', () => {
  for (const s of SAMPLES) {
    describe(s.name, () => {
      const scene = s.build();

      it('is a valid home that saves and opens again', () => {
        const r = parseSceneFile(serializeScene(scene));
        expect(r.ok).toBe(true);
      });

      it('has named rooms, doors, a roof and lights', () => {
        const rooms = Object.values(scene.rooms);
        expect(rooms.length).toBeGreaterThanOrEqual(2);
        expect(Object.keys(scene.openings).length).toBeGreaterThanOrEqual(rooms.length);
        expect(Object.values(scene.roofs).length).toBeGreaterThanOrEqual(1);
        expect(Object.values(scene.items).some((i) => i.assetId.includes('light') || i.assetId === 'led-panel')).toBe(true);
      });

      it('every room can be entered: it has at least one door or arch on its walls', () => {
        for (const r of Object.values(scene.rooms)) {
          const walls = new Set(r.wallLoop);
          const doors = Object.values(scene.openings).filter((o) => walls.has(o.wallId) && (o.type === 'door' || o.type === 'arch'));
          expect(doors.length, `${s.id}: ${r.name}`).toBeGreaterThanOrEqual(1);
        }
      });

      it('furniture does not overlap other furniture', () => {
        const solid = Object.values(scene.items).flatMap((it) => {
          const a = getAsset(it.assetId);
          return a && a.mount === 'floor' && a.solid && a.size[2] >= 0.3 ? [{ it, a, fp: itemFootprint(a, [it.position[0], it.position[2]], it.rotationY, it.scale) }] : [];
        });
        const bad: string[] = [];
        for (let i = 0; i < solid.length; i++) {
          for (let j = i + 1; j < solid.length; j++) {
            if (solid[i]!.it.levelId !== solid[j]!.it.levelId) continue;
            const p = penetration(solid[i]!.fp, solid[j]!.fp);
            if (p > 0.06) bad.push(`${solid[i]!.a.id} / ${solid[j]!.a.id} (${p.toFixed(2)} m)`);
          }
        }
        expect(bad).toEqual([]);
      });

      it('indoor furniture stands inside a room of its floor', () => {
        const outdoor = new Set(['outdoor', 'nature', 'scenery']);
        const bad: string[] = [];
        for (const it of Object.values(scene.items)) {
          const a = getAsset(it.assetId);
          if (!a || a.mount !== 'floor' || outdoor.has(a.category) || a.id === 'car') continue;
          const rooms = levelRoomsOf(scene, it.levelId);
          const inside = rooms.some((poly) => itemFootprint(a, [it.position[0], it.position[2]], it.rotationY, it.scale).every((p) => pointIn(p, poly, 0.08)));
          if (!inside) bad.push(`${a.id} at ${it.position[0].toFixed(1)},${it.position[2].toFixed(1)} on ${scene.levels[it.levelId]!.name}`);
        }
        expect(bad).toEqual([]);
      });

      it('stairs reach a floor that opens', () => {
        for (const st of Object.values(scene.stairs)) {
          expect(stairNeedsRoom(scene, st, (lid) => levelRoomsOf(scene, lid))).toBeNull();
        }
      });
    });
  }
});

function pointIn(p: Vec2, poly: Vec2[], slack: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  if (inside) return true;
  // a point just outside the inner outline still counts (items touch the wall)
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2));
    if (Math.hypot(p[0] - (a[0] + (b[0] - a[0]) * t), p[1] - (a[1] + (b[1] - a[1]) * t)) <= slack) return true;
  }
  return false;
}
