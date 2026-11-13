import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Asset } from '@hd/assets';
import type { Item } from '@hd/scene-schema';
import { blindDrop, curtainLook, curtainPanel, isBlind, type CurtainLook } from '../curtainShape';

/** Height of the rod above the top edge of the hanging cloth, and how far the rod stands from the wall (m). */
const ROD_Z = 0.09;
const HEADER = 0.03;

/**
 * A curtain or blind, rebuilt for its size, style and how far it is drawn. The cloth is a grid of vertices pushed into
 * sine folds (see curtainShape.ts); like ScreenFace it undoes the item's scale so folds keep their real size.
 */
export function CurtainFace({ item, asset, color }: { item: Item; asset: Asset; color: string }) {
  const face = asset.curtain!;
  const [sx, sy, sz] = item.scale;
  const W = face.w * sx;
  const H = face.h * sy;
  const look = useMemo(() => curtainLook(item, asset), [item, asset]);

  const parts = useMemo(() => buildCurtain(W, H, look), [W, H, look]);
  useEffect(() => () => parts.geometries.forEach((g) => g.dispose()), [parts]);

  const sheerLook = look.style === 'sheer';
  const fabric = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: look.style === 'venetian' ? 0.5 : 0.95,
        metalness: look.style === 'venetian' ? 0.15 : 0,
        side: THREE.DoubleSide,
        transparent: sheerLook,
        opacity: sheerLook ? 0.55 : 1,
        depthWrite: !sheerLook,
      }),
    [color, look.style, sheerLook],
  );
  const sheer = useMemo(
    () => new THREE.MeshStandardMaterial({ color: look.sheerColor, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }),
    [look.sheerColor],
  );
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: look.rodColor, roughness: 0.35, metalness: 0.7 }), [look.rodColor]);
  useEffect(() => () => fabric.dispose(), [fabric]);
  useEffect(() => () => sheer.dispose(), [sheer]);
  useEffect(() => () => metal.dispose(), [metal]);

  return (
    <group scale={[1 / sx, 1 / sy, 1 / sz]}>
      {parts.sheer && <mesh geometry={parts.sheer} material={sheer} castShadow={false} />}
      <mesh geometry={parts.fabric} material={fabric} castShadow receiveShadow />
      {parts.rings && <mesh geometry={parts.rings} material={metal} castShadow />}
      {parts.rod && <mesh geometry={parts.rod} material={metal} castShadow />}
    </group>
  );
}

interface Built {
  fabric: THREE.BufferGeometry;
  sheer: THREE.BufferGeometry | null;
  rings: THREE.BufferGeometry | null;
  rod: THREE.BufferGeometry | null;
  geometries: THREE.BufferGeometry[];
}

/** A flat grid `w` x `h`, its left edge at x0 and its top at yTop, folded by `fold(x, t)` (t: 0 at the hem, 1 at the head). */
function cloth(w: number, h: number, x0: number, yTop: number, z0: number, segX: number, segY: number, fold: (xLocal: number, t: number) => number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h, segX, segY);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const xl = pos.getX(i) + w / 2; // 0..w
    const t = (pos.getY(i) + h / 2) / h; // 0 hem .. 1 head
    pos.setXYZ(i, x0 + xl, yTop - h / 2 + pos.getY(i), z0 + fold(xl, t));
  }
  g.computeVertexNormals();
  return g;
}

/** The curtain pair of one style at depth `z`: two panels pulled open by `open`, folds from curtainPanel(). */
function curtainPair(W: number, H: number, style: CurtainLook['style'], fullness: number, z: number, open: number): { geo: THREE.BufferGeometry; crests: Array<[number, number]> } {
  const hang = H - HEADER;
  const lay = curtainPanel(W, style, open, fullness);
  const lambda = lay.width / lay.folds;
  const list: THREE.BufferGeometry[] = [];
  const crests: Array<[number, number]> = [];
  for (const s of [-1, 1] as const) {
    const x0 = s === -1 ? -W / 2 : W / 2 - lay.width;
    // folds are tapered at the head (gathered on the rod) and open out toward the hem
    const fold = (xl: number, t: number) => lay.amplitude * (0.5 + 0.5 * (1 - t) ** 0.7) * Math.sin((2 * Math.PI * xl) / lambda + (s === -1 ? 0 : Math.PI));
    list.push(cloth(lay.width, hang, x0, H / 2 - HEADER, z, Math.max(8, lay.folds * 8), 14, fold));
    for (let k = 0; k < lay.folds; k++) {
      const xl = (k + 0.25) * lambda; // crest of sin
      crests.push([x0 + xl, z + lay.amplitude * Math.sin(Math.PI / 2)]);
    }
  }
  return { geo: mergeGeometries(list)!, crests };
}

function buildCurtain(W: number, H: number, look: CurtainLook): Built {
  const geometries: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(g: T): T => (geometries.push(g), g);
  let fabricGeo: THREE.BufferGeometry;
  let sheerGeo: THREE.BufferGeometry | null = null;
  let rings: THREE.BufferGeometry | null = null;
  let rod: THREE.BufferGeometry | null = null;

  if (look.style === 'roman') {
    const drop = blindDrop(H, look.open);
    const bands = Math.max(1, Math.round(drop / 0.2));
    const band = drop / bands;
    // flat panel with a soft horizontal ridge at every band
    const panel = cloth(W, drop, -W / 2, H / 2, 0.03, 4, bands * 6, (_xl, t) => 0.012 * Math.abs(Math.sin((Math.PI * t * drop) / band)));
    const stackH = 0.03 + 0.12 * Math.min(1, look.open);
    const stack = new THREE.BoxGeometry(W, stackH, 0.06);
    stack.translate(0, H / 2 - stackH / 2, 0.04);
    fabricGeo = keep(mergeGeometries([panel, stack])!);
    panel.dispose();
    stack.dispose();
  } else if (look.style === 'venetian') {
    const drop = blindDrop(H, look.open);
    const n = Math.max(2, Math.floor(drop / 0.03));
    const slats: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.BoxGeometry(W - 0.02, 0.006, 0.034);
      s.rotateX(-0.75);
      s.translate(0, H / 2 - 0.035 - ((i + 0.5) * (drop - 0.035)) / n, 0.04);
      slats.push(s);
    }
    const rail = new THREE.BoxGeometry(W, 0.035 + 0.1 * look.open, 0.045);
    rail.translate(0, H / 2 - (0.035 + 0.1 * look.open) / 2, 0.04);
    const bottom = new THREE.BoxGeometry(W - 0.02, 0.014, 0.03);
    bottom.translate(0, H / 2 - drop, 0.04);
    fabricGeo = keep(mergeGeometries([...slats, rail, bottom])!);
    [...slats, rail, bottom].forEach((g) => g.dispose());
  } else {
    const main = curtainPair(W, H, look.style, look.fullness, ROD_Z, look.open);
    fabricGeo = keep(main.geo);
    if (look.sheer) sheerGeo = keep(curtainPair(W, H, 'sheer', 2, ROD_Z - 0.05, Math.min(1, look.open * 0.95)).geo);
    if (look.style === 'eyelet') {
      const ringsList = main.crests.map(([x, z]) => {
        const r = new THREE.TorusGeometry(0.024, 0.005, 6, 14);
        r.translate(x, H / 2 - HEADER - 0.015, z + 0.006);
        return r;
      });
      if (ringsList.length) {
        rings = keep(mergeGeometries(ringsList)!);
        ringsList.forEach((g) => g.dispose());
      }
    }
  }

  if (look.rod === 'rod' && !isBlind(look.style)) {
    const body = new THREE.CylinderGeometry(0.011, 0.011, W + 0.1, 12);
    body.rotateZ(Math.PI / 2);
    body.translate(0, H / 2, ROD_Z);
    const parts: THREE.BufferGeometry[] = [body];
    for (const s of [-1, 1]) {
      const ball = new THREE.SphereGeometry(0.022, 12, 8);
      ball.translate(s * (W / 2 + 0.07), H / 2, ROD_Z);
      parts.push(ball);
      const bracket = new THREE.BoxGeometry(0.02, 0.02, ROD_Z);
      bracket.translate(s * (W / 2 + 0.02), H / 2, ROD_Z / 2);
      parts.push(bracket);
    }
    rod = keep(mergeGeometries(parts)!);
    parts.forEach((g) => g.dispose());
  } else if (look.rod === 'track' && !isBlind(look.style)) {
    const t = new THREE.BoxGeometry(W + 0.04, 0.025, 0.04);
    t.translate(0, H / 2 + 0.008, 0.03);
    rod = keep(t);
  }
  return { fabric: fabricGeo, sheer: sheerGeo, rings, rod, geometries };
}
