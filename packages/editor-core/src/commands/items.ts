import { getAsset } from '@hd/assets';
import { newId, type Id, type Vec3 } from '@hd/scene-schema';
import { wrapAngle } from '../placement';
import type { Command } from '../types';

export const MIN_ITEM_SCALE = 0.5;
export const MAX_ITEM_SCALE = 2;
/** Trees and other plants can grow beyond ordinary furniture sizes. */
export const MIN_GROW_SCALE = 0.2;
export const MAX_GROW_SCALE = 3;
const clampGrow = (s: number) => Math.min(MAX_GROW_SCALE, Math.max(MIN_GROW_SCALE, s));
const clampScale = (s: number) => Math.min(MAX_ITEM_SCALE, Math.max(MIN_ITEM_SCALE, s));

export interface AddItemParams {
  levelId: Id;
  assetId: string;
  /** [x, y, z]; y is measured from the floor of the level (see solvePlacement). */
  position: Vec3;
  rotationY?: number;
  scale?: Vec3;
  /** Main colour override (hex). */
  variant?: string;
}

/** Place an item from the catalog. Unknown assets / levels are ignored. */
export function addItem(params: AddItemParams, rng?: () => number): Command {
  const id = newId('item', rng);
  return {
    type: 'AddItem',
    label: 'Add item',
    apply(d) {
      if (!d.levels[params.levelId] || !getAsset(params.assetId)) return;
      d.items[id] = {
        id,
        levelId: params.levelId,
        assetId: params.assetId,
        position: [params.position[0], params.position[1], params.position[2]],
        rotationY: wrapAngle(params.rotationY ?? 0),
        scale: params.scale ? [params.scale[0], params.scale[1], params.scale[2]] : [1, 1, 1],
        ...(params.variant ? { variant: params.variant } : {}),
      };
    },
  };
}

/** Move/turn one item (drag gesture). */
export function setItemTransform(id: Id, t: { position?: Vec3; rotationY?: number }): Command {
  return {
    type: 'SetItemTransform',
    label: 'Move item',
    apply(d) {
      const it = d.items[id];
      if (!it || it.locked) return;
      if (t.position) it.position = [t.position[0], t.position[1], t.position[2]];
      if (t.rotationY !== undefined) it.rotationY = wrapAngle(t.rotationY);
    },
  };
}

/** Shift several items on the floor plan (arrow-key nudging, group moves). */
export function translateItems(ids: readonly Id[], dx: number, dz: number): Command {
  return {
    type: 'TranslateItems',
    label: ids.length > 1 ? 'Move items' : 'Move item',
    apply(d) {
      for (const id of ids) {
        const it = d.items[id];
        if (it && !it.locked) it.position = [it.position[0] + dx, it.position[1], it.position[2] + dz];
      }
    },
  };
}

export interface ItemProps {
  rotationY?: number;
  /** Uniform scale factor (0.5–2). */
  scale?: number;
  /** Main colour (hex); null resets to the catalog default. */
  variant?: string | null;
  /** Text on the item (name plate, house number); '' or null removes it. */
  text?: string | null;
  locked?: boolean;
}

export function setItemsProps(ids: readonly Id[], props: ItemProps): Command {
  return {
    type: 'SetItemsProps',
    label: ids.length > 1 ? 'Edit items' : 'Edit item',
    apply(d) {
      for (const id of ids) {
        const it = d.items[id];
        if (!it) continue;
        if (props.rotationY !== undefined) it.rotationY = wrapAngle(props.rotationY);
        if (props.scale !== undefined) {
          const s = clampScale(props.scale);
          it.scale = [s, s, s];
        }
        if (props.variant === null) delete it.variant;
        else if (props.variant !== undefined) it.variant = props.variant;
        if (props.text === null || props.text === '') delete it.text;
        else if (props.text !== undefined) it.text = props.text.slice(0, 40);
        if (props.locked !== undefined) it.locked = props.locked || undefined;
      }
    },
  };
}

/** Turn items by `delta` radians about their own centres. */
export function rotateItems(ids: readonly Id[], delta: number): Command {
  return {
    type: 'RotateItems',
    label: 'Rotate',
    apply(d) {
      for (const id of ids) {
        const it = d.items[id];
        if (it && !it.locked) it.rotationY = wrapAngle(it.rotationY + delta);
      }
    },
  };
}

export function removeItems(ids: readonly Id[]): Command {
  return {
    type: 'RemoveItems',
    label: ids.length > 1 ? 'Delete items' : 'Delete item',
    apply(d) {
      for (const id of ids) delete d.items[id];
    },
  };
}

/** Copy items, offset on the plan so the copy is visible. New ids derive from one base id. */
export function duplicateItems(ids: readonly Id[], offset: [number, number] = [0.4, 0.4], rng?: () => number): Command {
  const base = newId('item', rng);
  return {
    type: 'DuplicateItems',
    label: ids.length > 1 ? 'Duplicate items' : 'Duplicate item',
    apply(d) {
      let k = 0;
      for (const id of ids) {
        const it = d.items[id];
        if (!it) continue;
        const nid = `${base}.${k++}`;
        d.items[nid] = {
          ...it,
          id: nid,
          position: [it.position[0] + offset[0], it.position[1], it.position[2] + offset[1]],
          scale: [it.scale[0], it.scale[1], it.scale[2]],
          locked: undefined,
        };
      }
    },
  };
}

export interface ItemSize {
  /** Same factor in width, depth and height (0.2–3 × the catalog size). */
  uniform?: number;
  /** Factor for the footprint (width and depth together) and for the height on its own. */
  width?: number;
  height?: number;
}

/** Resize items freely: all round (`uniform`), or the footprint and the height on their own (a taller or a broader tree). */
export function setItemsSize(ids: readonly Id[], size: ItemSize): Command {
  return {
    type: 'SetItemsSize',
    label: ids.length > 1 ? 'Resize items' : 'Resize item',
    apply(d) {
      for (const id of ids) {
        const it = d.items[id];
        if (!it || it.locked) continue;
        let [sx, sy, sz] = it.scale;
        if (size.uniform !== undefined) sx = sy = sz = clampGrow(size.uniform);
        if (size.width !== undefined) sx = sz = clampGrow(size.width);
        if (size.height !== undefined) sy = clampGrow(size.height);
        it.scale = [sx, sy, sz];
      }
    },
  };
}
