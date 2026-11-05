import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { Item } from '@hd/scene-schema';
import { getAsset } from '@hd/assets';
import { setItemTransform, solvePlacement } from '@hd/editor-core';
import { editor, useUi } from '../../plan/session';
import { canPick, CLICK_SLOP_PX, pickObject, SelectionBox, useIsSelected } from '../pick';
import { buildFurniture } from './builders';
import { contactShadowGeometry, contactShadowMaterial } from './contactShadow';

/**
 * One placed item. Models are cloned from a shared template, so geometry and materials are shared between all
 * copies of the same asset/colour (cheap to place many; instancing is a later optimisation if profiling asks).
 * `item.position[1]` is measured from the floor of the item's level.
 *
 * In 3D you can click an item to select it and drag floor items along the floor (walls and neighbours snap like
 * on the plan; the whole drag is one undo step).
 */
export function ItemMesh({ item, elevation }: { item: Item; elevation: number }) {
  const object = useMemo(() => buildFurniture(item.assetId, item.variant), [item.assetId, item.variant]);
  const box = useMemo(() => {
    if (!object) return null;
    const b = new THREE.Box3().setFromObject(object);
    return { center: b.getCenter(new THREE.Vector3()).toArray() as [number, number, number], size: b.getSize(new THREE.Vector3()).toArray() as [number, number, number] };
  }, [object]);
  const selected = useIsSelected(item.id);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const drag = useRef<{ x: number; y: number; grab: [number, number]; started: boolean } | null>(null);

  if (!object) return null;
  const asset = getAsset(item.assetId);
  const draggable = !!asset && asset.mount === 'floor' && !item.locked;
  const groundHit = (e: ThreeEvent<PointerEvent>): THREE.Vector3 | null =>
    e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(elevation + item.position[1])), new THREE.Vector3());

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!canPick()) return;
    e.stopPropagation();
    const hit = draggable ? groundHit(e) : null;
    drag.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, grab: hit ? [hit.x - item.position[0], hit.z - item.position[2]] : [0, 0], started: false };
    if (draggable) (e.target as unknown as { setPointerCapture(id: number): void }).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || !draggable || !asset) return;
    if (!d.started && Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) <= CLICK_SLOP_PX) return;
    const hit = groundHit(e);
    if (!hit) return;
    if (!d.started) {
      d.started = true;
      if (controls) controls.enabled = false; // the camera must not orbit while a piece is being moved
      editor.select([item.id]);
      editor.beginTransaction('Move item');
    }
    const ui = useUi.getState();
    const pl = solvePlacement(editor.getState().scene, item.levelId, asset, [hit.x - d.grab[0], hit.z - d.grab[1]], {
      rotationY: item.rotationY,
      scale: item.scale,
      snapWalls: ui.snap.walls,
      grid: ui.snap.grid ? 0.05 : 0,
    });
    if (pl) editor.preview(setItemTransform(item.id, { position: pl.position, rotationY: pl.rotationY }));
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    e.stopPropagation();
    if (draggable) (e.target as unknown as { releasePointerCapture(id: number): void }).releasePointerCapture(e.pointerId);
    if (d.started) {
      editor.commitTransaction();
      if (controls) controls.enabled = true;
    } else {
      pickObject(item.id, item.levelId, e.nativeEvent.shiftKey || useUi.getState().additive);
    }
  };

  return (
    <group
      position={[item.position[0], elevation + item.position[1], item.position[2]]}
      rotation={[0, item.rotationY, 0]}
      scale={item.scale}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      // Selection happens on pointer-up; swallow the click so the floor behind does not also react to it.
      onClick={(e) => canPick() && e.stopPropagation()}
      onPointerOver={(e) => {
        if (!canPick()) return;
        e.stopPropagation();
        document.body.style.cursor = draggable ? 'grab' : 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      <primitive object={object} />
      {asset && asset.mount === 'floor' && asset.size[2] >= 0.05 && (
        <mesh geometry={contactShadowGeometry} material={contactShadowMaterial()} position={[0, 0.006, 0]} scale={[asset.size[0] * 1.3 + 0.1, 1, asset.size[1] * 1.3 + 0.1]} renderOrder={1} raycast={() => null} />
      )}
      {selected && box && <SelectionBox center={box.center} size={box.size} />}
    </group>
  );
}
