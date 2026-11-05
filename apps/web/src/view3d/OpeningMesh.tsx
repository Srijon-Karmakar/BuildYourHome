import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FRAME_COLORS, LEAF_COLORS, type Opening } from '@hd/scene-schema';
import type { WallFootprint } from '@hd/geometry';

/**
 * Placeholder fixtures (ADR-013): boxes with believable materials; real catalog models replace them later.
 * Styles: doors flush | panel | glass | double, windows single | double | sliding. Colours are per opening.
 */

const BAR = 0.05; // frame bar width (m)
const OPEN_ANGLE = (80 * Math.PI) / 180;

type Size = [number, number, number];

const GLASS = new THREE.MeshStandardMaterial({ color: '#bcd4e6', transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false });
const HANDLE = new THREE.MeshStandardMaterial({ color: '#8d8a83', roughness: 0.3, metalness: 0.85 });

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)));
  return `#${c.getHexString()}`;
}

function Box({ size, pos, mat, shadow = true }: { size: Size; pos: Size; mat: THREE.Material; shadow?: boolean }) {
  return (
    <mesh position={pos} material={mat} castShadow={shadow} receiveShadow={shadow}>
      <boxGeometry args={size} />
    </mesh>
  );
}

interface LeafProps {
  w: number;
  h: number;
  style: string;
  leaf: THREE.Material;
  panel: THREE.Material;
}

/** A door leaf in its own frame: x ∈ [0, w] away from the hinge, y ∈ [0, h], thickness 4 cm centred on z = 0. */
function Leaf({ w, h, style, leaf, panel }: LeafProps) {
  const T = 0.04;
  const handleY = Math.min(1.0, h * 0.48);
  const handles = (
    <>
      <Box size={[0.11, 0.022, 0.026]} pos={[w - 0.08, handleY, T / 2 + 0.013]} mat={HANDLE} />
      <Box size={[0.11, 0.022, 0.026]} pos={[w - 0.08, handleY, -T / 2 - 0.013]} mat={HANDLE} />
    </>
  );

  if (style === 'glass') {
    const lowerH = h * 0.42;
    const rail = 0.09;
    return (
      <>
        <Box size={[w, lowerH, T]} pos={[w / 2, lowerH / 2, 0]} mat={leaf} />
        <Box size={[rail, h - lowerH, T]} pos={[rail / 2, lowerH + (h - lowerH) / 2, 0]} mat={leaf} />
        <Box size={[rail, h - lowerH, T]} pos={[w - rail / 2, lowerH + (h - lowerH) / 2, 0]} mat={leaf} />
        <Box size={[w, rail, T]} pos={[w / 2, h - rail / 2, 0]} mat={leaf} />
        <Box size={[w - 2 * rail, h - lowerH - rail, 0.01]} pos={[w / 2, lowerH + (h - lowerH - rail) / 2, 0]} mat={GLASS} shadow={false} />
        {handles}
      </>
    );
  }

  return (
    <>
      <Box size={[w, h, T]} pos={[w / 2, h / 2, 0]} mat={leaf} />
      {style === 'panel' &&
        ([1, -1] as const).map((side) => (
          <group key={side}>
            <Box size={[w * 0.64, h * 0.3, 0.012]} pos={[w / 2, h * 0.24, side * (T / 2 + 0.005)]} mat={panel} />
            <Box size={[w * 0.64, h * 0.3, 0.012]} pos={[w / 2, h * 0.7, side * (T / 2 + 0.005)]} mat={panel} />
          </group>
        ))}
      {handles}
    </>
  );
}

interface Props {
  opening: Opening;
  fp: WallFootprint;
  elevation: number;
}

/**
 * Door/window fixture placed in the wall's own frame: +x along the wall from node a, +y up,
 * +z toward the wall's L side.
 */
export function OpeningMesh({ opening: o, fp, elevation }: Props) {
  const rotY = useMemo(() => Math.atan2(-fp.dir[1], fp.dir[0]), [fp.dir]);
  const frameHex = o.frameColor ?? FRAME_COLORS[0].id;
  const leafHex = o.leafColor ?? LEAF_COLORS[0].id;

  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: frameHex, roughness: 0.55 }), [frameHex]);
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ color: leafHex, roughness: 0.5 }), [leafHex]);
  const panel = useMemo(() => new THREE.MeshStandardMaterial({ color: shade(leafHex, -0.06), roughness: 0.5 }), [leafHex]);
  useEffect(() => () => frame.dispose(), [frame]);
  useEffect(() => () => leaf.dispose(), [leaf]);
  useEffect(() => () => panel.dispose(), [panel]);

  const t = fp.thickness;
  const depth = t + 0.02;
  const x0 = o.offset - o.width / 2;
  const x1 = o.offset + o.width / 2;
  const y0 = o.sill;
  const y1 = o.sill + o.height;
  let content: React.ReactNode = null;

  if (o.type === 'door') {
    const style = o.style ?? 'flush';
    const sgn = o.flip.swing ? -1 : 1; // +1 opens toward the L side (+z)
    const innerW = o.width - 2 * BAR;
    const leafH = o.height - BAR - 0.01;
    const pivot = (hingeX: number, dir: 1 | -1, width: number, k: string) => {
      const theta = Math.atan2(-sgn * Math.sin(OPEN_ANGLE), dir * Math.cos(OPEN_ANGLE));
      return (
        <group key={k} position={[hingeX, y0 + 0.01, 0]} rotation={[0, theta, 0]}>
          <Leaf w={width} h={leafH} style={style === 'double' ? 'flush' : style} leaf={leaf} panel={panel} />
        </group>
      );
    };
    content = (
      <>
        <Box size={[BAR, o.height, depth]} pos={[x0 + BAR / 2, y0 + o.height / 2, 0]} mat={frame} />
        <Box size={[BAR, o.height, depth]} pos={[x1 - BAR / 2, y0 + o.height / 2, 0]} mat={frame} />
        <Box size={[o.width, BAR, depth]} pos={[o.offset, y1 - BAR / 2, 0]} mat={frame} />
        {style === 'double'
          ? [pivot(x0 + BAR, 1, innerW / 2 - 0.002, 'l'), pivot(x1 - BAR, -1, innerW / 2 - 0.002, 'r')]
          : pivot(o.flip.side ? x1 - BAR : x0 + BAR, o.flip.side ? -1 : 1, innerW, 'a')}
      </>
    );
  } else if (o.type === 'window') {
    const style = o.style ?? (o.width > 1.0 ? 'double' : 'single');
    const fd = Math.max(0.07, t * 0.55);
    const innerW = o.width - 2 * BAR;
    const innerH = o.height - 2 * BAR;
    const cy = y0 + o.height / 2;
    content = (
      <>
        <Box size={[o.width, BAR, fd]} pos={[o.offset, y0 + BAR / 2, 0]} mat={frame} />
        <Box size={[o.width, BAR, fd]} pos={[o.offset, y1 - BAR / 2, 0]} mat={frame} />
        <Box size={[BAR, innerH, fd]} pos={[x0 + BAR / 2, cy, 0]} mat={frame} />
        <Box size={[BAR, innerH, fd]} pos={[x1 - BAR / 2, cy, 0]} mat={frame} />
        {style === 'sliding' ? (
          <>
            {/* Two overlapping sashes on separate tracks. */}
            <Box size={[innerW * 0.55, innerH, 0.012]} pos={[x0 + BAR + innerW * 0.275, cy, -0.014]} mat={GLASS} shadow={false} />
            <Box size={[innerW * 0.55, innerH, 0.012]} pos={[x1 - BAR - innerW * 0.275, cy, 0.014]} mat={GLASS} shadow={false} />
            <Box size={[0.035, innerH, 0.03]} pos={[x0 + BAR + innerW * 0.55, cy, -0.014]} mat={frame} />
            <Box size={[0.035, innerH, 0.03]} pos={[x1 - BAR - innerW * 0.55, cy, 0.014]} mat={frame} />
          </>
        ) : (
          <>
            {style === 'double' && <Box size={[0.04, innerH, fd * 0.8]} pos={[o.offset, cy, 0]} mat={frame} />}
            <Box size={[innerW, innerH, 0.012]} pos={[o.offset, cy, 0]} mat={GLASS} shadow={false} />
          </>
        )}
        {/* Sill board projecting slightly on both faces. */}
        <Box size={[o.width + 0.12, 0.03, t + 0.1]} pos={[o.offset, y0 - 0.015, 0]} mat={frame} />
      </>
    );
  }

  if (!content) return null;
  return (
    <group position={[fp.origin[0], elevation, fp.origin[1]]} rotation={[0, rotY, 0]}>
      {content}
    </group>
  );
}
