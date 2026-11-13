import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getAsset } from '@hd/assets';
import { capGeometry, curvedSlabGeometry, featureBulge, featureLook, slabGeometry } from './featureGeo';

const box = (g: THREE.BufferGeometry) => new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
const size = (g: THREE.BufferGeometry) => box(g).getSize(new THREE.Vector3());

describe('wall feature geometry', () => {
  it('a straight slab stands on the floor, centred, with the requested size', () => {
    const b = box(slabGeometry(3, 2.8, 0.15));
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.y).toBeCloseTo(2.8);
    expect(b.max.x).toBeCloseTo(1.5);
    expect(b.max.z).toBeCloseTo(0.075);
    expect(b.min.z).toBeCloseTo(-0.075);
  });

  it('UVs are in metres: a 3 m x 2.8 m face covers 3 x 2.8 texture units', () => {
    const uv = slabGeometry(3, 2.8, 0.15).attributes.uv as THREE.BufferAttribute;
    let maxU = 0;
    let maxV = 0;
    for (let i = 0; i < uv.count; i++) {
      maxU = Math.max(maxU, uv.getX(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    expect(maxU).toBeCloseTo(3);
    expect(maxV).toBeCloseTo(2.8);
  });

  it('the cap sits on top and overhangs a little', () => {
    const b = box(capGeometry(3, 2.8, 0.15));
    expect(b.min.y).toBeCloseTo(2.8);
    expect(b.max.x).toBeCloseTo(1.55);
  });

  it('a curved slab keeps its tip-to-tip width, bulges forward by the computed amount and stands on the floor', () => {
    const g = curvedSlabGeometry(4, 3, 0.2, 90);
    const s = size(g);
    const b = box(g);
    expect(s.x).toBeCloseTo(4, 1); // tip to tip
    expect(s.y).toBeCloseTo(3);
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.z).toBeCloseTo(featureBulge(4, 90), 2);
    expect(b.min.z).toBeLessThanOrEqual(0.001); // the back of the tips
  });

  it('a negative bend is the mirror image (the middle goes back), a tiny bend is straight', () => {
    const b = box(curvedSlabGeometry(4, 3, 0.2, -90));
    expect(b.min.z).toBeCloseTo(-featureBulge(4, 90), 2);
    expect(size(curvedSlabGeometry(4, 3, 0.2, 1)).z).toBeCloseTo(0.2);
    expect(featureBulge(4, 0)).toBe(0);
  });

  it('every wall feature in the catalog has a face, a known finish, and starts as it says', () => {
    for (const id of ['feature-wall', 'feature-curved', 'feature-box', 'feature-extended']) {
      const a = getAsset(id)!;
      expect(a.feature, id).toBeTruthy();
      expect(a.feature!.w).toBeCloseTo(a.size[0]);
      expect(a.feature!.depth).toBeCloseTo(a.size[1]);
      expect(a.feature!.h).toBeCloseTo(a.size[2]);
      expect(a.solid, id).toBe(true);
    }
    expect(featureLook({}, getAsset('feature-curved')!)).toMatchObject({ shape: 'curved', curve: 90, cap: false });
    expect(featureLook({ feature: { curve: -40, cap: true } }, getAsset('feature-curved')!)).toMatchObject({ curve: -40, cap: false }); // no cap on a curve
    expect(featureLook({ feature: { curve: 50, cap: true, material: 'wall-brick-grey' } }, getAsset('feature-wall')!)).toMatchObject({ curve: 0, cap: true, material: 'wall-brick-grey' });
  });
});
