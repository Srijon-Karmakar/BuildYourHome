/**
 * A small close button for the floating cards (Views, Floor settings, Snap, Home, Walk view…). Shown on phones, tablets and
 * short windows (see `.pop-close` in styles.css), where there is no Esc key and no easy way to tap "away" from a card
 * that fills most of the screen.
 */
export function PopClose({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="pop-close" aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 5L15 15M15 5L5 15" />
      </svg>
    </button>
  );
}
