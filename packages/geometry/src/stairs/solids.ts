import type { Vec2 } from '@hd/scene-schema';

export type V3 = [number, number, number];

/** Small solid shapes (bars, rods, posts, panels, columns) collected as flat-shaded triangles in one buffer. */
export class Solids {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];

  tri(a: [number, number, number], b: [number, number, number], c: [number, number, number], inside: [number, number, number]): void {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const len = Math.hypot(n[0]!, n[1]!, n[2]!);
    if (len < 1e-12) return;
    n = n.map((v) => v / len);
    const m = [(a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]];
    if (n[0]! * m[0]! + n[1]! * m[1]! + n[2]! * m[2]! < 0) {
      [b, c] = [c, b];
      n = n.map((v) => -v);
    }
    for (const p of [a, b, c]) {
      this.pos.push(...p);
      this.nor.push(n[0]!, n[1]!, n[2]!);
      this.uv.push(p[0] + p[2], p[1]);
    }
  }

  quad(a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number], inside: [number, number, number]): void {
    this.tri(a, b, c, inside);
    this.tri(a, c, d, inside);
  }

  /** A bar from a to b, `w` wide (sideways) and `h` tall. */
  bar(a: [number, number, number], b: [number, number, number], w: number, h: number): void {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(d[0]!, d[1]!, d[2]!);
    if (l < 1e-6) return;
    d[0]! /= l; d[1]! /= l; d[2]! /= l;
    // side = up × d (horizontal); up2 = d × side.
    let s = [d[2]!, 0, -d[0]!];
    const sl = Math.hypot(s[0]!, s[2]!);
    s = sl < 1e-6 ? [1, 0, 0] : [s[0]! / sl, 0, s[2]! / sl];
    const u = [d[1]! * s[2]! - d[2]! * s[1]!, d[2]! * s[0]! - d[0]! * s[2]!, d[0]! * s[1]! - d[1]! * s[0]!];
    const sgn = u[1]! < 0 ? -1 : 1;
    const corner = (p: [number, number, number], i: number, j: number): [number, number, number] => [p[0] + s[0]! * (w / 2) * i + u[0]! * sgn * (h / 2) * j, p[1] + s[1]! * (w / 2) * i + u[1]! * sgn * (h / 2) * j, p[2] + s[2]! * (w / 2) * i + u[2]! * sgn * (h / 2) * j];
    const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const A = [corner(a, -1, -1), corner(a, 1, -1), corner(a, 1, 1), corner(a, -1, 1)];
    const B = [corner(b, -1, -1), corner(b, 1, -1), corner(b, 1, 1), corner(b, -1, 1)];
    for (let k = 0; k < 4; k++) this.quad(A[k]!, A[(k + 1) % 4]!, B[(k + 1) % 4]!, B[k]!, mid);
    this.quad(A[0]!, A[1]!, A[2]!, A[3]!, mid);
    this.quad(B[0]!, B[1]!, B[2]!, B[3]!, mid);
  }

  /** A round rod from a to b (an `n`-sided prism). */
  rod(a: [number, number, number], b: [number, number, number], r: number, n = 8): void {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(d[0]!, d[1]!, d[2]!);
    if (l < 1e-6) return;
    d[0]! /= l; d[1]! /= l; d[2]! /= l;
    let s1 = [d[2]!, 0, -d[0]!];
    const sl = Math.hypot(s1[0]!, s1[2]!);
    s1 = sl < 1e-6 ? [1, 0, 0] : [s1[0]! / sl, 0, s1[2]! / sl];
    const u = [d[1]! * s1[2]! - d[2]! * s1[1]!, d[2]! * s1[0]! - d[0]! * s1[2]!, d[0]! * s1[1]! - d[1]! * s1[0]!];
    const ring = (p: [number, number, number], k: number): [number, number, number] => {
      const t = (k / n) * Math.PI * 2;
      const c = Math.cos(t) * r;
      const s = Math.sin(t) * r;
      return [p[0] + s1[0]! * c + u[0]! * s, p[1] + s1[1]! * c + u[1]! * s, p[2] + s1[2]! * c + u[2]! * s];
    };
    const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    for (let k = 0; k < n; k++) {
      this.quad(ring(a, k), ring(a, k + 1), ring(b, k + 1), ring(b, k), mid);
      this.tri(a, ring(a, k), ring(a, k + 1), mid);
      this.tri(b, ring(b, k), ring(b, k + 1), mid);
    }
  }

  post(x: number, z: number, y0: number, y1: number, w: number): void {
    this.bar([x, y0, z], [x, y1, z], w, w);
  }

  /** A thin panel between two vertical edges. */
  panel(p: Vec2, q: Vec2, y0p: number, y1p: number, y0q: number, y1q: number, thick: number): void {
    const d = [q[0] - p[0], q[1] - p[1]];
    const l = Math.hypot(d[0]!, d[1]!) || 1;
    const nx = (-d[1]! / l) * (thick / 2);
    const nz = (d[0]! / l) * (thick / 2);
    const mid: [number, number, number] = [(p[0] + q[0]) / 2, (y0p + y1q) / 2, (p[1] + q[1]) / 2];
    const f = (s: number): [[number, number, number], [number, number, number], [number, number, number], [number, number, number]] => [
      [p[0] + nx * s, y0p, p[1] + nz * s],
      [q[0] + nx * s, y0q, q[1] + nz * s],
      [q[0] + nx * s, y1q, q[1] + nz * s],
      [p[0] + nx * s, y1p, p[1] + nz * s],
    ];
    const A = f(1);
    const B = f(-1);
    this.quad(A[0], A[1], A[2], A[3], mid);
    this.quad(B[0], B[1], B[2], B[3], mid);
    this.quad(A[3], A[2], B[2], B[3], mid);
    this.quad(A[0], A[1], B[1], B[0], mid);
    this.quad(A[0], A[3], B[3], B[0], mid);
    this.quad(A[1], A[2], B[2], B[1], mid);
  }

  column(cx: number, cz: number, r: number, y0: number, y1: number, n = 10): void {
    const mid: [number, number, number] = [cx, (y0 + y1) / 2, cz];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const p0: [number, number, number] = [cx + r * Math.cos(a0), y0, cz + r * Math.sin(a0)];
      const p1: [number, number, number] = [cx + r * Math.cos(a1), y0, cz + r * Math.sin(a1)];
      this.quad(p0, p1, [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], mid);
      this.tri([cx, y1, cz], [p0[0], y1, p0[2]], [p1[0], y1, p1[2]], mid);
    }
  }
}
