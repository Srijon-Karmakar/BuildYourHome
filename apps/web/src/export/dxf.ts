import type { Scene } from '@hd/scene-schema';
import { buildDrawing, type LayerName } from './drawing';

/** AutoCAD colour index per layer. */
const COLOR: Record<LayerName, number> = {
  WALLS: 7, DOORS: 1, WINDOWS: 5, ROOMS: 3, FURNITURE: 8, STAIRS: 6, BALCONY: 4, GARDEN: 3, PLOT: 2, DIMENSIONS: 7,
};

const MM = 1000; // the drawing is written in millimetres (real-world size, 1:1)
/** Paper text height × this = real-world text height for a 1:50 plan. */
const TEXT_SCALE = 50;

const fmt = (n: number): string => (Math.round(n * 1000) / 1000).toString();

/** A layer name AutoCAD accepts: letters, digits, `_`, `-`, `$`; upper-case. */
const layerName = (level: string, layer: string): string => `${level.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'FLOOR'}_${layer}`;

/**
 * An ASCII DXF (AutoCAD R12 format, which every CAD program reads): one set of layers per floor
 * (e.g. GROUND_FLOOR_WALLS), millimetres, north up (plan z is flipped into DXF y).
 */
export function planDxf(scene: Scene): string {
  const out: string[] = [];
  const g = (code: number, value: string | number) => out.push(String(code), String(value));

  const layers: Array<{ name: string; color: number }> = [];
  const body: string[] = [];
  const bodyG = (code: number, value: string | number) => body.push(String(code), String(value));

  for (const levelId of scene.levelOrder) {
    const d = buildDrawing(scene, levelId);
    const used = new Set<LayerName>();
    for (const p of d.prims) {
      used.add(p.layer);
      const lay = layerName(d.levelName, p.layer);
      if (p.type === 'poly') {
        if (p.pts.length < 2) continue;
        bodyG(0, 'POLYLINE');
        bodyG(8, lay);
        bodyG(66, 1);
        bodyG(70, p.closed ? 1 : 0);
        for (const q of p.pts) {
          bodyG(0, 'VERTEX');
          bodyG(8, lay);
          bodyG(10, fmt(q[0] * MM));
          bodyG(20, fmt(-q[1] * MM));
          bodyG(30, 0);
        }
        bodyG(0, 'SEQEND');
        bodyG(8, lay);
      } else {
        bodyG(0, 'TEXT');
        bodyG(8, lay);
        bodyG(10, fmt(p.pos[0] * MM));
        bodyG(20, fmt(-p.pos[1] * MM));
        bodyG(30, 0);
        bodyG(40, fmt(p.mm * TEXT_SCALE));
        bodyG(1, p.text.replace(/[^\x20-\x7e]/g, (c) => (c === '²' ? '2' : c === '×' ? 'x' : '?')));
        if (p.align === 'center') {
          bodyG(72, 1);
          bodyG(11, fmt(p.pos[0] * MM));
          bodyG(21, fmt(-p.pos[1] * MM));
          bodyG(31, 0);
        }
      }
    }
    for (const l of used) layers.push({ name: layerName(d.levelName, l), color: COLOR[l] });
  }

  // HEADER
  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$INSUNITS'); g(70, 4);
  g(0, 'ENDSEC');
  // TABLES (layers)
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
  g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.length + 1);
  g(0, 'LAYER'); g(2, '0'); g(70, 0); g(62, 7); g(6, 'CONTINUOUS');
  for (const l of layers) {
    g(0, 'LAYER'); g(2, l.name); g(70, 0); g(62, l.color); g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  // ENTITIES
  g(0, 'SECTION'); g(2, 'ENTITIES');
  out.push(...body);
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return out.join('\n') + '\n';
}
