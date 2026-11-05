import { describe, expect, it } from 'vitest';
import { loadScene } from '@hd/scene-schema';
import { buildFamilyHome, buildQuickRoom, buildStudio, buildTemplate } from './templates';

const stats = (s: ReturnType<typeof buildStudio>) => ({
  walls: Object.keys(s.walls).length,
  rooms: Object.values(s.rooms),
  doors: Object.values(s.openings).filter((o) => o.type === 'door').length,
  windows: Object.values(s.openings).filter((o) => o.type === 'window').length,
  arches: Object.values(s.openings).filter((o) => o.type === 'arch').length,
});

describe('templates', () => {
  it('every template is a valid scene that survives save/load', () => {
    for (const id of ['blank', 'room', 'studio', 'home', 'sample'] as const) {
      const s = buildTemplate(id);
      expect(loadScene(JSON.parse(JSON.stringify(s))).ok, id).toBe(true);
    }
  });

  it('quick room: one named room of the requested size, a door and windows', () => {
    const s = buildQuickRoom(5, 4);
    const st = stats(s);
    expect(st.walls).toBe(4);
    expect(st.rooms).toHaveLength(1);
    expect(st.rooms[0]!.name).toBe('Room');
    expect(st.doors).toBe(1);
    expect(st.windows).toBeGreaterThanOrEqual(2);
    // centre-line 5 × 4, so the node coordinates reach exactly 5 and 4
    const xs = Object.values(s.nodes).map((n) => n.p[0]);
    const zs = Object.values(s.nodes).map((n) => n.p[1]);
    expect(Math.max(...xs)).toBe(5);
    expect(Math.max(...zs)).toBe(4);
  });

  it('quick room clamps silly sizes and snaps to 5 cm', () => {
    const tiny = buildQuickRoom(0.2, -3);
    expect(Math.max(...Object.values(tiny.nodes).map((n) => n.p[0]))).toBe(1.5);
    const huge = buildQuickRoom(500, 500);
    expect(Math.max(...Object.values(huge.nodes).map((n) => n.p[0]))).toBe(30);
    const odd = buildQuickRoom(4.03, 3.51);
    expect(Math.max(...Object.values(odd.nodes).map((n) => n.p[0]))).toBeCloseTo(4.05);
  });

  it('a small room still gets a door (windows are optional)', () => {
    const s = buildQuickRoom(2, 2);
    expect(stats(s).doors).toBe(1);
  });

  it('studio: living + bath with their names, a front door and a bathroom door', () => {
    const st = stats(buildStudio());
    expect(st.rooms.map((r) => r.name).sort()).toEqual(['Bath', 'Living']);
    expect(st.doors).toBe(2);
    expect(st.windows).toBe(3);
  });

  it('family home: five named rooms, doors, an archway and windows — nothing got dropped', () => {
    const st = stats(buildFamilyHome());
    expect(st.rooms.map((r) => r.name).sort()).toEqual(['Bath', 'Bedroom', 'Bedroom 2', 'Kitchen', 'Living']);
    expect(st.rooms.find((r) => r.name === 'Bath')!.type).toBe('bathroom');
    expect(st.doors).toBe(4);
    expect(st.arches).toBe(1);
    expect(st.windows).toBe(7);
  });

  it('blank is empty; sample is furnished', () => {
    const blank = buildTemplate('blank');
    expect(Object.keys(blank.walls)).toHaveLength(0);
    expect(Object.keys(buildTemplate('sample').items).length).toBeGreaterThan(10);
  });
});
