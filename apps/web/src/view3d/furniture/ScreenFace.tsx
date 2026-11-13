import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Asset } from '@hd/assets';
import type { Item } from '@hd/scene-schema';
import { canvasSize, curveShape, drawScreen, MIN_CURVE_DEG, screenLook } from '../screenArt';

/** True when the item is a wall screen bent far enough to be drawn as a curve (its flat catalog model is then left out). */
export function isCurvedScreen(item: Item, asset: Asset | undefined): boolean {
  return !!asset?.screen?.curvable && Math.abs(screenLook(item, asset).curve) >= MIN_CURVE_DEG;
}

/**
 * The lit picture of an LED screen. Sits inside the item's (scaled) group but undoes the scale, so the frame keeps
 * its real thickness however the screen is stretched. Each screen has its own small canvas texture; a scrolling
 * ticker redraws it ~30 times a second (the only animated thing in the scene, so it asks for frames itself).
 * Wall screens can also be bent (`curve`): the picture then follows a cylinder arc and the housing is rebuilt as a
 * curved slab (see CurvedBody).
 */
export function ScreenFace({ item, asset, color }: { item: Item; asset: Asset; color: string }) {
  const face = asset.screen!;
  const [sx, sy, sz] = item.scale;
  const W = face.w * sx;
  const H = face.h * sy;
  const look = useMemo(() => screenLook(item, asset), [item, asset]);
  const curved = isCurvedScreen(item, asset);
  const shape = useMemo(() => curveShape(W, curved ? look.curve : 0), [W, curved, look.curve]);
  // The picture is spread over the arc, so its shape (and the canvas) follows the arc length, not the chord.
  const b = Math.min(look.bezel, W / 4, H / 4);
  const pw = Math.max(0.01, (curved ? shape.arc : W) - 2 * b);
  const ph = Math.max(0.01, H - 2 * b);
  const [cw, ch] = canvasSize(pw / ph, Math.max(pw, ph) > 2.5 ? 1024 : 768);

  const canvas = useMemo(() => document.createElement('canvas'), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const concave = curved && look.curve < 0;
  useEffect(() => {
    // A concave screen is built turned round, which mirrors the picture: flip it back.
    texture.repeat.x = concave ? -1 : 1;
    texture.offset.x = concave ? 1 : 0;
    texture.needsUpdate = true;
  }, [texture, concave]);

  const img = useRef<HTMLImageElement | null>(null);
  const invalidate = useThree((s) => s.invalidate);

  const draw = (t: number) => {
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScreen(ctx, cw, ch, look, t, look.show === 'image' && img.current?.complete ? img.current : null);
    texture.needsUpdate = true;
  };

  // Redraw whenever the settings or the size change; load the user's picture first when there is one.
  useEffect(() => {
    let alive = true;
    if (look.show === 'image' && look.image) {
      const i = new Image();
      i.onload = () => {
        if (!alive) return;
        img.current = i;
        draw(0);
        invalidate();
      };
      i.src = look.image;
    } else img.current = null;
    draw(0);
    invalidate();
    return () => {
      alive = false;
    };
  }, [look, cw, ch]); // eslint-disable-line react-hooks/exhaustive-deps

  const animate = look.show === 'text' && look.scroll;
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.getElapsedTime();
    if (t - last.current >= 1 / 30) {
      last.current = t;
      draw(t);
    }
    invalidate(); // frameloop is "demand": keep the ticker moving
  });

  const lit = look.show !== 'off';
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.FrontSide }), [texture]);
  useEffect(() => {
    // Brighter than 1 lets the picture bloom at night; the darkened 'off' screen is a glossy black panel.
    glow.color.setScalar(lit ? look.brightness : 1);
    glow.side = concave ? THREE.BackSide : THREE.FrontSide; // a concave picture is the inside of the cylinder
    glow.needsUpdate = true;
  }, [glow, lit, look.brightness, concave]);
  useEffect(() => () => glow.dispose(), [glow]);
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide }), [color]);
  useEffect(() => () => frame.dispose(), [frame]);
  const off = useMemo(() => new THREE.MeshStandardMaterial({ color: '#050608', roughness: 0.12, metalness: 0.3, side: concave ? THREE.BackSide : THREE.FrontSide }), [concave]);
  useEffect(() => () => off.dispose(), [off]);

  const screenMat = lit ? glow : off;
  return (
    <group scale={[1 / sx, 1 / sy, 1 / sz]}>
      <group position={[0, face.y * sy, face.z * sz]}>
        {curved ? (
          <CurvedBody W={W} H={H} ph={ph} pw={pw} depth={face.z * sz} signed={look.curve} frame={frame} screen={screenMat} id={item.id} />
        ) : (
          <>
            {b > 0.0005 && (
              <mesh position={[0, 0, 0.004]} material={frame}>
                <planeGeometry args={[W, H]} />
              </mesh>
            )}
            <mesh position={[0, 0, 0.006]} material={screenMat} userData={{ screen: item.id }}>
              <planeGeometry args={[pw, ph]} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

/**
 * A bent screen: a slab whose front is an arc of a cylinder, built round a circle centre so that its two edges stay
 * on the wall plane (z = 0 of the face) and the middle bulges out (`signed` > 0) or sinks in (< 0).
 * `W` is the chord between the edges, `pw` the picture's arc length, `ph` its height, `depth` the slab thickness.
 */
function CurvedBody({ W, H, ph, pw, depth, signed, frame, screen, id }: { W: number; H: number; ph: number; pw: number; depth: number; signed: number; frame: THREE.Material; screen: THREE.Material; id: string }) {
  const concave = signed < 0;
  const { radius: R, arc } = curveShape(W, signed);
  const thetaFull = arc / R; // radians
  const thetaPic = Math.min(thetaFull, pw / R);
  const thick = Math.min(Math.max(depth, 0.04), R * 0.9);
  const rIn = concave ? R + 0.004 : R - thick;
  const rOut = concave ? R + thick : R - 0.004;
  const seg = Math.max(8, Math.min(96, Math.round((thetaFull * 180) / Math.PI / 2.5)));
  const cz = (concave ? 1 : -1) * R * Math.cos(thetaFull / 2);

  const geo = useMemo(() => {
    const picture = new THREE.CylinderGeometry(R, R, ph, seg, 1, true, -thetaPic / 2, thetaPic);
    const shell = (r: number) => new THREE.CylinderGeometry(r, r, H, seg, 1, true, -thetaFull / 2, thetaFull);
    // top and bottom edge of the slab (a ring lying flat, spanning the same arc)
    const cap = new THREE.RingGeometry(Math.min(rIn, rOut), Math.max(rIn, rOut), seg, 1, Math.PI / 2 - thetaFull / 2, thetaFull);
    cap.rotateX(Math.PI / 2);
    const end = new THREE.PlaneGeometry(Math.abs(rOut - rIn), H);
    return { picture, back: shell(rIn), front: shell(rOut), cap, end };
  }, [R, ph, seg, thetaPic, thetaFull, H, rIn, rOut]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  const rMid = (rIn + rOut) / 2;
  return (
    <group position={[0, 0, cz]} rotation={[0, concave ? Math.PI : 0, 0]}>
      <mesh geometry={geo.picture} material={screen} userData={{ screen: id }} />
      <mesh geometry={geo.front} material={frame} />
      <mesh geometry={geo.back} material={frame} />
      <mesh geometry={geo.cap} material={frame} position={[0, H / 2, 0]} />
      <mesh geometry={geo.cap} material={frame} position={[0, -H / 2, 0]} />
      {[-1, 1].map((s) => {
        const phi = (s * thetaFull) / 2;
        return <mesh key={s} geometry={geo.end} material={frame} position={[rMid * Math.sin(phi), 0, rMid * Math.cos(phi)]} rotation={[0, phi - Math.PI / 2, 0]} />;
      })}
    </group>
  );
}
