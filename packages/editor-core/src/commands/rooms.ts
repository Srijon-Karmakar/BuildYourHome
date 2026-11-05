import type { Id, Room } from '@hd/scene-schema';
import type { Command } from '../types';

export type RoomProps = Partial<Pick<Room, 'name' | 'type' | 'floorMaterial' | 'ceilingMaterial' | 'hasCeiling'>>;

export function setRoomProps(roomId: Id, props: RoomProps): Command {
  return {
    type: 'SetRoomProps',
    label: 'Edit room',
    apply(d) {
      const r = d.rooms[roomId];
      if (r) Object.assign(r, props);
    },
  };
}
