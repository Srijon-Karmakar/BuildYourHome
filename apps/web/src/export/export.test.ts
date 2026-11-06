import { describe, expect, it } from 'vitest';
import { buildDemoScene } from '../plan/demo';
import { buildDrawing, pickScale, SCALES } from './drawing';
import { planDxf } from './dxf';
import { PdfDoc } from './pdf';
import { planPdf } from './pdfPlan';

const text = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

describe('drawing', () => {
  const scene = buildDemoScene();
  const d = buildDrawing(scene, scene.levelOrder[0]!);

  it('has walls, door and window symbols, rooms with areas, furniture and overall dimensions', () => {
    const layers = new Set(d.prims.map((p) => p.layer));
    for (const l of ['WALLS', 'DOORS', 'WINDOWS', 'ROOMS', 'FURNITURE', 'DIMENSIONS']) expect(layers.has(l as never), l).toBe(true);
    const labels = d.prims.filter((p) => p.type === 'text').map((p) => (p.type === 'text' ? p.text : ''));
    expect(labels).toEqual(expect.arrayContaining(['Living', 'Bedroom']));
    expect(labels.some((t) => /m²$/.test(t))).toBe(true);
    expect(labels.some((t) => /^10(\.0+)? m$/.test(t) || /10/.test(t))).toBe(true); // 10 m overall width
  });

  it('bounds contain every point (so nothing is cut off the page)', () => {
    for (const p of d.prims) for (const q of p.type === 'poly' ? p.pts : [p.pos]) {
      expect(q[0]).toBeGreaterThanOrEqual(d.min[0] - 1e-9);
      expect(q[0]).toBeLessThanOrEqual(d.max[0] + 1e-9);
      expect(q[1]).toBeGreaterThanOrEqual(d.min[1] - 1e-9);
      expect(q[1]).toBeLessThanOrEqual(d.max[1] + 1e-9);
    }
  });

  it('picks the largest standard scale that fits', () => {
    expect(pickScale([10, 6], [273, 150])).toBe(50); // 10 m at 1:50 = 200 mm
    expect(pickScale([10, 6], [150, 100])).toBe(75);
    expect(pickScale([10, 6], [100, 60])).toBe(100);
    expect(pickScale([1000, 1000], [100, 100])).toBe(SCALES[SCALES.length - 1]);
  });
});

describe('PDF writer', () => {
  it('writes a valid file: header, correct xref offsets, trailer', () => {
    const doc = new PdfDoc('Test (home)');
    const p = doc.addPage(297, 210);
    p.rect(10, 10, 50, 30);
    p.path([[0, 0], [20, 20], [40, 0]], true, 'f');
    p.text(20, 20, 'Hello (world) \\ ² × ✓', 4, { bold: true });
    const s = text(doc.build());
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...s.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    entries.forEach((off, i) => expect(s.slice(off, off + `${i + 1} 0 obj`.length), `object ${i + 1}`).toBe(`${i + 1} 0 obj`));
    // text is escaped and unsupported characters are replaced, not dropped silently
    expect(s).toContain('(Hello \\(world\\) \\\\ ² × ?)');
    expect(s).toContain('/Count 1');
  });

  it('stream /Length matches the stream', () => {
    const doc = new PdfDoc();
    doc.addPage(100, 100).rect(1, 1, 5, 5);
    const s = text(doc.build());
    const m = /\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(s)!;
    expect(m[2]!.length).toBe(Number(m[1]));
  });
});

describe('plan PDF', () => {
  it('makes one page per floor with scale, title block and room names', () => {
    const scene = buildDemoScene();
    const r = planPdf(scene, 'A4');
    expect(r.pages).toHaveLength(scene.levelOrder.length);
    expect(r.pages[0]!.scale).toBe(50);
    const s = text(r.bytes);
    expect(s).toContain('(Scale 1 : 50)');
    expect(s).toContain('(Sample home)');
    expect(s).toContain('(Living)');
    expect(s).toContain(`/Count ${scene.levelOrder.length}`);
  });

  it('A3 allows a larger scale than A4 for the same home', () => {
    const scene = buildDemoScene();
    expect(planPdf(scene, 'A3').pages[0]!.scale).toBeLessThanOrEqual(planPdf(scene, 'A4').pages[0]!.scale);
  });
});

describe('DXF', () => {
  const scene = buildDemoScene();
  const dxf = planDxf(scene);
  const lines = dxf.split('\n');

  it('is a well-formed R12 file: group-code/value pairs, balanced sections, EOF', () => {
    expect(lines.length % 2).toBe(1); // trailing newline gives an empty last element
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i + 1 < lines.length - 1; i += 2) pairs.push([lines[i]!.trim(), lines[i + 1]!]);
    for (const [code] of pairs) expect(Number.isInteger(Number(code)), code).toBe(true);
    const count = (v: string) => pairs.filter(([c, val]) => c === '0' && val === v).length;
    expect(count('SECTION')).toBe(count('ENDSEC'));
    expect(count('SECTION')).toBe(3);
    expect(count('POLYLINE')).toBe(count('SEQEND'));
    expect(pairs[pairs.length - 1]).toEqual(['0', 'EOF']);
  });

  it('has the floor-named layers, walls, text in millimetres and north up', () => {
    expect(dxf).toContain('GROUND_FLOOR_WALLS');
    expect(dxf).toContain('GROUND_FLOOR_ROOMS');
    expect(dxf).toContain('AC1009');
    expect(dxf).toMatch(/\nLiving\n/);
    // the 10 m wide house reaches x = 10 000 mm
    const xs = [...dxf.matchAll(/\n10\n(-?[\d.]+)\n/g)].map((m) => Number(m[1]));
    expect(Math.max(...xs)).toBeGreaterThan(9000);
    // north up: plan z (south) is flipped, so the house sits at negative y
    const ys = [...dxf.matchAll(/\n20\n(-?[\d.]+)\n/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeLessThan(-5000);
  });

  it('replaces characters CAD text cannot hold', () => {
    expect(dxf).not.toMatch(/²|×/);
  });
});
