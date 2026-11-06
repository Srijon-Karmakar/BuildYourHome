import type { Scene, Vec2 } from '@hd/scene-schema';
import { buildDrawing, pickScale, type LayerName } from './drawing';
import { PdfDoc, type PdfPage } from './pdf';

export type Paper = 'A4' | 'A3';
/** Landscape sizes in millimetres. */
export const PAPER_MM: Record<Paper, Vec2> = { A4: [297, 210], A3: [420, 297] };

const MARGIN = 12;
const TITLE_H = 26;

const STYLE: Record<LayerName, { line: number; rgb: [number, number, number]; fill?: [number, number, number] }> = {
  WALLS: { line: 0.12, rgb: [0.07, 0.07, 0.07], fill: [0.07, 0.07, 0.07] },
  DOORS: { line: 0.18, rgb: [0.1, 0.1, 0.1] },
  WINDOWS: { line: 0.16, rgb: [0.1, 0.1, 0.1] },
  ROOMS: { line: 0.1, rgb: [0, 0, 0] },
  FURNITURE: { line: 0.14, rgb: [0.45, 0.45, 0.45] },
  STAIRS: { line: 0.16, rgb: [0.2, 0.2, 0.2] },
  BALCONY: { line: 0.22, rgb: [0.25, 0.25, 0.25] },
  GARDEN: { line: 0.12, rgb: [0.35, 0.45, 0.3], fill: [0.88, 0.92, 0.84] },
  PLOT: { line: 0.3, rgb: [0.48, 0.26, 0.21] },
  DIMENSIONS: { line: 0.12, rgb: [0.2, 0.2, 0.2] },
};

/** Draw order: ground first, then walls over it, then details and text. */
const ORDER: LayerName[] = ['GARDEN', 'PLOT', 'FURNITURE', 'BALCONY', 'STAIRS', 'WALLS', 'WINDOWS', 'DOORS', 'DIMENSIONS', 'ROOMS'];

function northArrow(page: PdfPage, x: number, y: number): void {
  page.stroke(0, 0, 0);
  page.fill(0, 0, 0);
  page.lineWidth(0.25);
  page.path([[x, y - 8], [x + 3, y + 4], [x, y + 2], [x - 3, y + 4]], true, 'B');
  page.text(x, y - 10, 'N', 3.2, { bold: true, align: 'center' });
}

function scaleBar(page: PdfPage, x: number, y: number, scale: number): void {
  // 1 m segments, up to 5; the bar stays under ~60 mm on paper.
  const segs = Math.max(1, Math.min(5, Math.floor(60 / (1000 / scale))));
  const seg = 1000 / scale;
  page.lineWidth(0.2);
  page.stroke(0, 0, 0);
  for (let i = 0; i < segs; i++) {
    page.fill(i % 2 === 0 ? 0 : 1, i % 2 === 0 ? 0 : 1, i % 2 === 0 ? 0 : 1);
    page.rect(x + i * seg, y, seg, 1.6, 'B');
  }
  page.fill(0, 0, 0);
  page.text(x, y - 1.2, '0', 2.2);
  page.text(x + segs * seg, y - 1.2, `${segs} m`, 2.2, { align: 'right' });
}

/** One page per floor, vector, at a standard scale, with a title block, scale bar and north arrow. */
export function planPdf(scene: Scene, paper: Paper): { bytes: Uint8Array; pages: Array<{ level: string; scale: number }> } {
  const doc = new PdfDoc(scene.meta.name);
  const info: Array<{ level: string; scale: number }> = [];
  const [pw, ph] = PAPER_MM[paper];
  const today = new Date().toISOString().slice(0, 10);

  scene.levelOrder.forEach((levelId, index) => {
    const d = buildDrawing(scene, levelId);
    const size: Vec2 = [d.max[0] - d.min[0], d.max[1] - d.min[1]];
    const portrait = size[1] > size[0] * 1.2;
    const W = portrait ? ph : pw;
    const H = portrait ? pw : ph;
    const avail: Vec2 = [W - 2 * MARGIN, H - 2 * MARGIN - TITLE_H - 6];
    const scale = pickScale(size, avail);
    const k = 1000 / scale;
    const ox = MARGIN + (avail[0] - size[0] * k) / 2;
    const oy = MARGIN + 3 + (avail[1] - size[1] * k) / 2;
    const X = (x: number) => ox + (x - d.min[0]) * k;
    const Y = (z: number) => oy + (z - d.min[1]) * k;

    const page = doc.addPage(W, H);
    page.stroke(0, 0, 0);
    page.lineWidth(0.35);
    page.rect(MARGIN - 4, MARGIN - 4, W - 2 * (MARGIN - 4), H - 2 * (MARGIN - 4));

    for (const layer of ORDER) {
      const st = STYLE[layer];
      for (const p of d.prims) {
        if (p.layer !== layer) continue;
        if (p.type === 'poly') {
          page.lineWidth(st.line);
          page.stroke(...st.rgb);
          if (layer === 'PLOT') page.dash(3, 1.6);
          else page.solid();
          const pts = p.pts.map((q): [number, number] => [X(q[0]), Y(q[1])]);
          if (p.fill && st.fill) {
            page.fill(...st.fill);
            page.path(pts, true, 'B');
          } else page.path(pts, p.closed, 'S');
          page.solid();
        } else {
          page.fill(...st.rgb);
          page.text(X(p.pos[0]), Y(p.pos[1]), p.text, p.mm, { bold: p.bold, align: p.align });
        }
      }
    }

    // Title block.
    const ty = H - MARGIN - TITLE_H + 2;
    page.stroke(0, 0, 0);
    page.lineWidth(0.35);
    page.rect(MARGIN - 4, ty, W - 2 * (MARGIN - 4), TITLE_H);
    page.fill(0, 0, 0);
    page.text(MARGIN, ty + 10, scene.meta.name, 6.5, { bold: true });
    page.text(MARGIN, ty + 17, `${d.levelName}  -  floor plan`, 3.6);
    page.text(MARGIN, ty + 22, `Drawn with Home Designer  -  ${today}`, 2.6);
    page.text(W - MARGIN, ty + 10, `Scale 1 : ${scale}`, 4.2, { bold: true, align: 'right' });
    page.text(W - MARGIN, ty + 17, `Sheet ${index + 1} of ${scene.levelOrder.length}  -  ${paper}`, 3, { align: 'right' });
    page.text(W - MARGIN, ty + 22, 'Dimensions in metres unless stated', 2.6, { align: 'right' });
    scaleBar(page, W / 2 - 25, ty + 16, scale);
    northArrow(page, W - MARGIN - 4, MARGIN + 12);

    info.push({ level: d.levelName, scale });
  });

  return { bytes: doc.build(), pages: info };
}
