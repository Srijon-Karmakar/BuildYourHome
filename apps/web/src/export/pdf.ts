/**
 * A tiny PDF writer: vector pages with lines, filled polygons and text in the built-in Helvetica fonts. No library,
 * no network. Everything is single-byte (Latin-1), so byte offsets in the cross-reference table are just string lengths.
 */
export const MM_TO_PT = 72 / 25.4;

/** Characters outside Latin-1 are replaced so the text stays valid (the built-in fonts cover Latin-1). */
const latin1 = (s: string): string => {
  let out = '';
  for (const ch of s) out += ch.codePointAt(0)! < 256 ? ch : '?';
  return out;
};
const esc = (s: string): string => latin1(s).replace(/([\\()])/g, '\\$1');
const num = (n: number): string => (Math.round(n * 1000) / 1000).toString();

export class PdfPage {
  private ops: string[] = [];
  constructor(
    readonly widthMm: number,
    readonly heightMm: number,
  ) {}

  /** Coordinates are millimetres from the TOP-LEFT of the page (y down), like drawing on paper. */
  private x(mm: number): string {
    return num(mm * MM_TO_PT);
  }
  private y(mm: number): string {
    return num((this.heightMm - mm) * MM_TO_PT);
  }

  lineWidth(mm: number): void {
    this.ops.push(`${num(mm * MM_TO_PT)} w`);
  }
  stroke(r: number, g: number, b: number): void {
    this.ops.push(`${num(r)} ${num(g)} ${num(b)} RG`);
  }
  fill(r: number, g: number, b: number): void {
    this.ops.push(`${num(r)} ${num(g)} ${num(b)} rg`);
  }
  dash(on: number, off: number): void {
    this.ops.push(`[${num(on * MM_TO_PT)} ${num(off * MM_TO_PT)}] 0 d`);
  }
  solid(): void {
    this.ops.push('[] 0 d');
  }

  /** Open or closed path; `paint` = stroke, fill, or both. */
  path(pts: readonly (readonly [number, number])[], closed: boolean, paint: 'S' | 'f' | 'B'): void {
    if (pts.length < 2) return;
    const head = pts.map((p, i) => `${this.x(p[0])} ${this.y(p[1])} ${i === 0 ? 'm' : 'l'}`);
    this.ops.push(head.join(' ') + (closed ? ' h ' : ' ') + paint);
  }

  rect(x: number, y: number, w: number, h: number, paint: 'S' | 'f' | 'B' = 'S'): void {
    this.ops.push(`${this.x(x)} ${this.y(y + h)} ${num(w * MM_TO_PT)} ${num(h * MM_TO_PT)} re ${paint}`);
  }

  /** Text with its baseline at (x, y); `sizeMm` is the font size in millimetres. */
  text(x: number, y: number, text: string, sizeMm: number, opts: { bold?: boolean; align?: 'left' | 'center' | 'right' } = {}): void {
    const size = sizeMm * MM_TO_PT;
    const w = estimateWidth(text, size);
    const dx = opts.align === 'center' ? -w / 2 : opts.align === 'right' ? -w : 0;
    this.ops.push(`BT /${opts.bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(x * MM_TO_PT + dx)} ${this.y(y)} Td (${esc(text)}) Tj ET`);
  }

  content(): string {
    return this.ops.join('\n');
  }
}

/** Rough width of Helvetica text (average glyph ≈ 0.52 em) — enough for centring labels. */
export function estimateWidth(text: string, sizePt: number): number {
  return text.length * sizePt * 0.52;
}

export class PdfDoc {
  private pages: PdfPage[] = [];
  constructor(private title = 'Floor plan') {}

  addPage(widthMm: number, heightMm: number): PdfPage {
    const p = new PdfPage(widthMm, heightMm);
    this.pages.push(p);
    return p;
  }

  /** The finished file as bytes. */
  build(): Uint8Array {
    const objs: string[] = [];
    // 1 catalog, 2 pages, 3 font, 4 bold font, then per page: page object + content stream.
    const pageObj = (i: number) => 5 + i * 2;
    const kids = this.pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ');
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${this.pages.length} >>`;
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    this.pages.forEach((p, i) => {
      const w = num(p.widthMm * MM_TO_PT);
      const h = num(p.heightMm * MM_TO_PT);
      objs[pageObj(i)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageObj(i) + 1} 0 R >>`;
      const body = latin1(p.content());
      objs[pageObj(i) + 1] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
    });
    const infoId = objs.length;
    objs[infoId] = `<< /Title (${esc(this.title)}) /Producer (Home Designer) >>`;

    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets: number[] = [];
    for (let i = 1; i < objs.length; i++) {
      offsets[i] = out.length;
      out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }
}
