import { editor, useUi } from '../plan/session';

const IconEnvironment = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M1.5 16.5L7 7.5L10.2 12L12.4 9.2L18.5 16.5Z" />
    <circle cx="14.5" cy="4.6" r="1.8" />
  </svg>
);

/** Opens the environment editor (scenery, sky, ground and trees). Lives in the bottom row beside Night and Views. */
export function EnvironmentButton() {
  const open = useUi((s) => s.envOpen);
  const setOpen = useUi((s) => s.setEnvOpen);
  return (
    <button
      type="button"
      className="pill small"
      aria-pressed={open}
      aria-label="Environment"
      title="Hills, sea, sky, weather, ground and trees around your home"
      onClick={() => {
        if (!open) editor.select([]); // the panel takes the place of the properties panel
        setOpen(!open);
      }}
    >
      <IconEnvironment />
      <span className="lbl">Environment</span>
    </button>
  );
}
