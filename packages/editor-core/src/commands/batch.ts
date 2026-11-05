import type { Command } from '../types';

/** Several commands as one undo step. */
export function batch(label: string, commands: Command[]): Command {
  return {
    type: 'Batch',
    label,
    apply(d) {
      for (const c of commands) c.apply(d);
    },
  };
}
