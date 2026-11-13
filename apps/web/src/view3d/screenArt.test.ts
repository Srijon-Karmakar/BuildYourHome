import { describe, expect, it } from 'vitest';
import { CATALOG, getAsset } from '@hd/assets';
import { lampsOf } from './lights';
import { canvasSize, curveShape, mix, screenLook, screenTone, wrapText } from './screenArt';
import { createEmptyScene, type Scene } from '@hd/scene-schema';

describe('screen art helpers', () => {
  it('fills in defaults from the catalog face and lets the item override them', () => {
    const asset = getAsset('led-ticker')!;
    expect(screenLook({}, asset)).toMatchObject({ show: 'text', text: 'WELCOME HOME', scroll: true, brightness: 1, castLight: true });
    expect(screenLook({ screen: { show: 'color', scroll: false, brightness: 1.4 } }, asset)).toMatchObject({ show: 'color', scroll: false, brightness: 1.4 });
  });

  it('every LED screen asset has a face that fits inside its footprint', () => {
    const screens = CATALOG.filter((a) => a.category === 'screens');
    expect(screens.length).toBeGreaterThanOrEqual(6);
    for (const a of screens) {
      expect(a.screen, a.id).toBeTruthy();
      expect(a.screen!.w, a.id).toBeLessThanOrEqual(a.size[0] + 1e-9);
      expect(a.screen!.h, a.id).toBeLessThanOrEqual(a.size[2] + 1e-9);
    }
  });

  it('blends colours and sizes the canvas to the face', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(canvasSize(16 / 9, 768)).toEqual([768, 432]);
    expect(canvasSize(0.5, 768)).toEqual([384, 768]);
    const [w, h] = canvasSize(1000);
    expect(w / h).toBeLessThanOrEqual(12.1);
  });

  it('wraps text to the width and the line limit, losing no words', () => {
    const measure = (t: string) => t.length * 10;
    expect(wrapText('one two three four', measure, 80, 3)).toEqual(['one two', 'three', 'four']);
    const lines = wrapText('a b c d e f g h', measure, 30, 2);
    expect(lines).toHaveLength(2);
    expect(lines.join(' ')).toBe('a b c d e f g h');
    expect(wrapText('', measure, 100, 2)).toEqual([]);
  });

  it('the light colour follows what is shown', () => {
    const a = getAsset('led-screen')!;
    expect(screenTone(screenLook({ screen: { show: 'color', color: '#ff0000' } }, a))).toBe('#ff0000');
    expect(screenTone(screenLook({ screen: { show: 'gradient', color: '#000000', color2: '#ffffff' } }, a))).toBe('#808080');
  });
});

describe('screens at night', () => {
  const sceneWith = (screen?: object): Scene => {
    const s = createEmptyScene();
    const levelId = Object.keys(s.levels)[0]!;
    s.items.s1 = { id: 's1', levelId, assetId: 'led-screen', position: [2, 1.5, 2], rotationY: 0, scale: [1, 1, 1], ...(screen ? { screen } : {}) } as Scene['items'][string];
    return s;
  };

  it('a lit screen is a light source in front of its face; off or "no room light" is not', () => {
    const lamps = lampsOf(sceneWith());
    expect(lamps).toHaveLength(1);
    expect(lamps[0]!.pos[2]).toBeGreaterThan(2); // in front (+z) of a screen facing +z
    expect(lampsOf(sceneWith({ show: 'off' }))).toHaveLength(0);
    expect(lampsOf(sceneWith({ castLight: false }))).toHaveLength(0);
  });

  it('a bigger or brighter screen throws more light', () => {
    const small = lampsOf(sceneWith())[0]!.power;
    const bright = lampsOf(sceneWith({ brightness: 2 }))[0]!.power;
    expect(bright).toBeGreaterThan(small);
  });
});

describe('curved screens', () => {
  it('a flat or almost flat screen has no bulge; a bend keeps the chord and lengthens the arc', () => {
    expect(curveShape(4, 0)).toEqual({ radius: Infinity, arc: 4, bulge: 0 });
    expect(curveShape(4, 1).bulge).toBe(0);
    const c = curveShape(4, 90);
    expect(c.radius).toBeCloseTo(4 / (2 * Math.sin(Math.PI / 4)));
    expect(c.arc).toBeGreaterThan(4);
    expect(c.bulge).toBeCloseTo(c.radius * (1 - Math.cos(Math.PI / 4)));
    expect(curveShape(4, -90)).toEqual(c); // the sign only says which way it bends
  });

  it('a half-pipe (180 degrees) is a half circle: arc = pi x chord / 2, bulge = chord / 2', () => {
    const c = curveShape(6, 180);
    expect(c.arc).toBeCloseTo((Math.PI * 6) / 2);
    expect(c.bulge).toBeCloseTo(3);
  });

  it('only screens that allow it take a bend; the curved facade starts bent', () => {
    expect(screenLook({ screen: { curve: 60 } }, getAsset('led-stand')!).curve).toBe(0);
    expect(screenLook({}, getAsset('led-curved')!).curve).toBe(70);
    expect(screenLook({ screen: { curve: -40 } }, getAsset('led-curved')!).curve).toBe(-40);
    expect(screenLook({ screen: { curve: 0 } }, getAsset('led-curved')!).curve).toBe(0);
  });
});
