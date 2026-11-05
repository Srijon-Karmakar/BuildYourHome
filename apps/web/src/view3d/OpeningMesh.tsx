import { useMemo } from 'react';
import * as THREE from 'three';
import type { Opening } from '@hd/scene-schema';
import type { WallFootprint } from '@hd/geometry';

/** Placeholder fixtures (ADR-013): simple boxes with believable materials; real catalog models replace them later. */
const mats = {
  frame: new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: 0.55 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#c9a47a', roughness: 0.5 }),
  glass: new THREE.MeshStandardMaterial({
    color: '#bcd4e6',
    transparent: true,
    opacity: 0.28,
    roughness: 0.05,
    depthWrite: false,
  }),
};

const BAR = 0.05; // frame bar width (m)
const OPEN_ANGLE = (80 * Math.PI) / 180;

type Size = [number, number, number];

function Box({ size, pos, mat, shadow = true }: { size: Size; pos: Size; mat: THREE.Material; shadow?: boolean }) {
  return (
    <mesh position={pos} material={mat} castShadow={shadow} receiveShadow={shadow}>
      <boxGeometry args={size} />
    </mesh>
  );
}

interface Props {
  opening: Opening;
  fp: WallFootprint;
  elevation: number;
}

/**
 * Door frame + hinged leaf, or window frame + glass + sill board, placed in the wall's own frame:
 * +x along the wall from node a, +y up, +z toward the wall's L side.
 */
export function OpeningMesh({ opening: o, fp, elevation }: Props) {
  const rotY = useMemo(() => Math.atan2(-fp.dir[1], fp.dir[0]), [fp.dir]);
  const t = fp.thickness;
  const depth = t + 0.02;
  const x0 = o.offset - o.width / 2;
  const x1 = o.offset + o.width / 2;
  const y0 = o.sill;
  const y1 = o.sill + o.height;

  let content: React.ReactNode = null;

  if (o.type === 'door') {
    const hingeAtEnd = o.flip.side;
    const dir = hingeAtEnd ? -1 : 1; // closed leaf lies from the hinge toward the other jamb
    const sgn = o.flip.swing ? -1 : 1; // +1 opens toward the L side (+z)
    const leafW = o.width - 2 * BAR;
    const leafH = o.height - BAR - 0.01;
    const hingeX = hingeAtEnd ? x1 - BAR : x0 + BAR;
    const theta = Math.atan2(-sgn * Math.sin(OPEN_ANGLE), dir * Math.cos(OPEN_ANGLE));
    content = (
      <>
        <Box size={[BAR, o.height, depth]} pos={[x0 + BAR / 2, y0 + o.height / 2, 0]} mat={mats.frame} />
        <Box size={[BAR, o.height, depth]} pos={[x1 - BAR / 2, y0 + o.height / 2, 0]} mat={mats.frame} />
        <Box size={[o.width, BAR, depth]} pos={[o.offset, y1 - BAR / 2, 0]} mat={mats.frame} />
        {/* Leaf: pivots at the hinge jamb, extends along local +x (flipped by theta when hinged at the far end). */}
        <group position={[hingeX, y0 + 0.01, 0]} rotation={[0, theta, 0]}>
          <Box size={[leafW, leafH, 0.04]} pos={[leafW / 2, leafH / 2, 0]} mat={mats.leaf} />
        </group>
      </>
    );
  } else if (o.type === 'window') {
    const fd = Math.max(0.07, t * 0.55);
    const innerW = o.width - 2 * BAR;
    const innerH = o.height - 2 * BAR;
    content = (
      <>
        <Box size={[o.width, BAR, fd]} pos={[o.offset, y0 + BAR / 2, 0]} mat={mats.frame} />
        <Box size={[o.width, BAR, fd]} pos={[o.offset, y1 - BAR / 2, 0]} mat={mats.frame} />
        <Box size={[BAR, innerH, fd]} pos={[x0 + BAR / 2, y0 + o.height / 2, 0]} mat={mats.frame} />
        <Box size={[BAR, innerH, fd]} pos={[x1 - BAR / 2, y0 + o.height / 2, 0]} mat={mats.frame} />
        {o.width > 1.0 && <Box size={[0.04, innerH, fd * 0.8]} pos={[o.offset, y0 + o.height / 2, 0]} mat={mats.frame} />}
        <Box size={[innerW, innerH, 0.012]} pos={[o.offset, y0 + o.height / 2, 0]} mat={mats.glass} shadow={false} />
        {/* Sill board projecting slightly on both faces. */}
        <Box size={[o.width + 0.12, 0.03, t + 0.1]} pos={[o.offset, y0 - 0.015, 0]} mat={mats.frame} />
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
