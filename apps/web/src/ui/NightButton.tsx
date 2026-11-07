import { useStore } from 'zustand';
import { setTimeOfDay } from '@hd/editor-core';
import { editor } from '../plan/session';
import { sunAt } from '../view3d/sun';

const IconMoon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a6.8 6.8 0 1 0 8.7 8.7Z" />
  </svg>
);
const IconSun = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M10 6.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6ZM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
  </svg>
);

/** The hour before the last tap on Night, so Day puts the light back where it was. */
let hourBefore = 12;

/** One tap for the night scene (dark sky, stars, moon, lamps on, windows glowing) and one tap back to the day you had. */
export function NightButton() {
  const hour = useStore(editor.store, (s) => s.scene.lighting.timeOfDay);
  const night = sunAt(hour).darkness > 0.5;
  return (
    <button
      type="button"
      className="pill small"
      aria-pressed={night}
      aria-label={night ? 'Day' : 'Night'}
      title={night ? 'Back to daylight' : 'Night scene: stars, moon, lamps on'}
      onClick={() => {
        if (night) editor.execute(setTimeOfDay(hourBefore));
        else {
          hourBefore = hour;
          editor.execute(setTimeOfDay(21.5));
        }
      }}
    >
      {night ? <IconSun /> : <IconMoon />}
      <span className="lbl">{night ? 'Day' : 'Night'}</span>
    </button>
  );
}
