import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { defaultInputUnit, formatFieldLength, parseLength } from '../lib/units';
import { editor } from '../plan/session';
import type { CatalogMaterial } from '../view3d/placeholderMaterials';

/** Label + control row used throughout the inspector. */
export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="f-row">
      <div className="f-label">
        {label}
        {hint && <small>{hint}</small>}
      </div>
      <div className="f-control">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="f-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

/** The little up / down pair at the end of a number field. Click = one step, Shift+click = ten steps. */
function Spin({ onStep, disabled }: { onStep: (dir: 1 | -1, big: boolean) => void; disabled?: boolean }) {
  const btn = (dir: 1 | -1) => (
    <button
      type="button"
      className={dir === 1 ? 'up' : 'down'}
      aria-label={dir === 1 ? 'Increase' : 'Decrease'}
      disabled={disabled}
      tabIndex={-1}
      // mousedown would blur the field and apply half-typed text first; the click itself does the step
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => onStep(dir, e.shiftKey)}
    >
      <svg viewBox="0 0 10 6" aria-hidden="true">
        <path d={dir === 1 ? 'M1 5L5 1L9 5' : 'M1 1L5 5L9 1'} />
      </svg>
    </button>
  );
  return (
    <span className="f-spin">
      {btn(1)}
      {btn(-1)}
    </span>
  );
}

/**
 * Length input. Type `3.5`, `350cm` or `12'6"`; Enter/blur applies, Esc cancels, ↑/↓ nudge (Shift = ×10).
 * `value === null` means "mixed" across a multi-selection (shown as –).
 */
export function LengthField({
  label,
  value,
  onCommit,
  disabled,
  min = 0,
  max = 100,
  step = 0.01,
  hint,
}: {
  label: string;
  value: number | null;
  onCommit: (metres: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  const id = useId();
  const units = useStore(editor.store, (s) => s.scene.meta.units);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const fmt = (m: number) => formatFieldLength(m, units);
  const parse = (t: string) => parseLength(t, defaultInputUnit(units));

  const shown = draft ?? (value === null ? '' : fmt(value));

  const apply = (text: string): boolean => {
    const m = parse(text);
    if (m === null || m < min || m > max) {
      setInvalid(true);
      window.setTimeout(() => setInvalid(false), 600);
      return false;
    }
    if (value === null || Math.abs(m - value) > 1e-9) onCommit(m);
    return true;
  };

  // The buttons move by at least 5 cm so a click is worth making (the arrow keys keep the fine step).
  const clickStep = Math.max(step, 0.05);
  const nudge = (dir: 1 | -1, big: boolean) => {
    const base = parse(draft ?? '') ?? value ?? min;
    const next = Math.round(Math.min(max, Math.max(min, base + dir * clickStep * (big ? 10 : 1))) * 1e4) / 1e4;
    setDraft(null);
    if (value === null || Math.abs(next - value) > 1e-9) onCommit(next);
  };

  return (
    <Row label={label} hint={hint}>
      <label className={`f-input${invalid ? ' invalid' : ''}${disabled ? ' disabled' : ''}`} htmlFor={id}>
        <input
          id={id}
          ref={input}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder="–"
          value={shown}
          onFocus={(e) => {
            setDraft(value === null ? '' : fmt(value));
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null && draft.trim() !== '') apply(draft);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') input.current?.blur();
            else if (e.key === 'Escape') {
              setDraft(null);
              input.current?.blur();
              e.stopPropagation();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const base = parse(draft ?? '') ?? value ?? 0;
              const next = Math.min(max, Math.max(min, base + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
              setDraft(fmt(next));
              onCommit(next);
            }
          }}
        />
        {units === 'm' && <span>m</span>}
        <Spin onStep={nudge} disabled={disabled} />
      </label>
    </Row>
  );
}

/** Degrees input (negative allowed). Enter/blur applies, Esc cancels, ↑/↓ turn by 5° (Shift 45°). `null` = mixed. */
export function AngleField({
  label,
  value,
  onCommit,
}: {
  label: string;
  /** Degrees, or null when the selection has differing angles. */
  value: number | null;
  onCommit: (degrees: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const fmt = (v: number) => String(Number(v.toFixed(1)));
  const parse = (t: string): number | null => {
    const n = Number(t.replace('°', '').replace(',', '.').trim());
    return t.trim() !== '' && Number.isFinite(n) ? n : null;
  };
  const apply = (t: string) => {
    const n = parse(t);
    if (n === null) {
      setInvalid(true);
      window.setTimeout(() => setInvalid(false), 600);
    } else if (value === null || Math.abs(n - value) > 1e-6) onCommit(n);
  };
  const nudge = (dir: 1 | -1, big: boolean) => {
    const next = Math.round(((parse(draft ?? '') ?? value ?? 0) + dir * (big ? 45 : 5)) * 1e3) / 1e3;
    setDraft(null);
    onCommit(next);
  };
  return (
    <Row label={label}>
      <label className={`f-input${invalid ? ' invalid' : ''}`} htmlFor={id}>
        <input
          id={id}
          ref={input}
          inputMode="decimal"
          autoComplete="off"
          placeholder="–"
          value={draft ?? (value === null ? '' : fmt(value))}
          onFocus={(e) => {
            setDraft(value === null ? '' : fmt(value));
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null && draft.trim() !== '') apply(draft);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') input.current?.blur();
            else if (e.key === 'Escape') {
              setDraft(null);
              input.current?.blur();
              e.stopPropagation();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const next = (parse(draft ?? '') ?? value ?? 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 45 : 5);
              setDraft(fmt(next));
              onCommit(next);
            }
          }}
        />
        <span>°</span>
        <Spin onStep={nudge} />
      </label>
    </Row>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  maxLength = 40,
}: {
  label: string;
  value: string;
  onCommit: (text: string) => void;
  maxLength?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Row label={label}>
      <label className="f-input wide" htmlFor={id}>
        <input
          id={id}
          ref={input}
          maxLength={maxLength}
          autoComplete="off"
          value={draft ?? value}
          onFocus={(e) => {
            setDraft(value);
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const t = (draft ?? value).trim();
            if (t && t !== value) onCommit(t);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') input.current?.blur();
            else if (e.key === 'Escape') {
              setDraft(null);
              input.current?.blur();
              e.stopPropagation();
            }
          }}
        />
      </label>
    </Row>
  );
}

/** Small segmented control. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  const buttons = (
    <div className={`f-seg${options.length > 2 ? ' wide' : ''}${options.length > 4 ? ' wrap' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
  // Three or more choices need the full panel width: label on top, buttons below.
  if (options.length > 2) {
    return (
      <div className="f-stack">
        <div className="f-label">{label}</div>
        {buttons}
      </div>
    );
  }
  return <Row label={label}>{buttons}</Row>;
}

export function SelectField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Row label={label}>
      <select className="f-select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch-row f-toggle" onClick={() => onChange(!checked)}>
      <div>
        {label}
        {hint && <small>{hint}</small>}
      </div>
      <div className="switch" />
    </button>
  );
}

/** Chips for common values, e.g. wall thickness presets. */
export function Chips({ items, current, onPick }: { items: Array<{ label: string; value: number }>; current: number | null; onPick: (v: number) => void }) {
  return (
    <div className="f-chips">
      {items.map((c) => (
        <button key={c.label} type="button" aria-pressed={current !== null && Math.abs(current - c.value) < 1e-6} onClick={() => onPick(c.value)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

const swatchBackground = (m: CatalogMaterial): CSSProperties => {
  switch (m.pattern) {
    case 'wood':
      return {
        backgroundColor: m.color === '#ffffff' ? '#c99a6a' : m.color,
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(60,35,15,0.28) 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, rgba(60,35,15,0.18) 0 1px, transparent 1px 16px)',
      };
    case 'tile':
      return {
        backgroundColor: m.color,
        backgroundImage: `linear-gradient(${m.grout ?? '#888'} 1.5px, transparent 1.5px), linear-gradient(90deg, ${m.grout ?? '#888'} 1.5px, transparent 1.5px)`,
        backgroundSize: '15px 15px',
      };
    case 'brick':
      return {
        backgroundColor: m.color,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.55) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(255,255,255,0.55) 1.5px, transparent 1.5px)',
        backgroundSize: '100% 6px, 12px 12px',
      };
    case 'stone':
      return {
        backgroundColor: m.color,
        backgroundImage:
          'linear-gradient(rgba(60,55,45,0.45) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(60,55,45,0.45) 1.5px, transparent 1.5px)',
        backgroundSize: '100% 9px, 14px 9px',
      };
    case 'panel':
      return {
        backgroundColor: m.color,
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(40,25,10,0.5) 0 1.5px, transparent 1.5px 6px)',
      };
    case 'subway':
      return {
        backgroundColor: m.color,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.7) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(255,255,255,0.7) 1.5px, transparent 1.5px)',
        backgroundSize: '100% 6px, 12px 12px',
      };
    case 'terrazzo':
      return {
        backgroundColor: '#efece5',
        backgroundImage:
          'radial-gradient(#8f8a80 1.2px, transparent 1.6px), radial-gradient(#b8a58c 1.4px, transparent 1.8px), radial-gradient(#6f6a62 1px, transparent 1.4px)',
        backgroundSize: '9px 9px, 13px 11px, 7px 12px',
      };
    case 'carpet':
      return {
        backgroundColor: m.color,
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.18) 0.6px, transparent 0.8px)',
        backgroundSize: '3px 3px',
      };
    default:
      return { backgroundColor: m.color };
  }
};

/** Plain colour chips (frame / door colours). `value` may be null for "mixed". */
export function ColorSwatches({
  label,
  items,
  value,
  onPick,
}: {
  label: string;
  items: ReadonlyArray<{ id: string; name: string }>;
  value: string | null;
  onPick: (hex: string) => void;
}) {
  const current = items.find((c) => c.id === value);
  return (
    <div className="f-swatches">
      <div className="f-label">
        {label}
        <small>{value === null ? 'Mixed' : (current?.name ?? '')}</small>
      </div>
      <div className="f-grid" role="radiogroup" aria-label={label}>
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            title={c.name}
            aria-label={c.name}
            className="swatch"
            style={{ backgroundColor: c.id }}
            onClick={() => onPick(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Material picker: a grid of swatches with names on hover / long-press. */
export function Swatches({
  label,
  items,
  value,
  onPick,
}: {
  label: string;
  items: CatalogMaterial[];
  value: string | null;
  onPick: (id: string) => void;
}) {
  const current = items.find((m) => m.id === value);
  return (
    <div className="f-swatches">
      <div className="f-label">
        {label}
        <small>{value === null ? 'Mixed' : (current?.name ?? '')}</small>
      </div>
      <div className="f-grid" role="radiogroup" aria-label={label}>
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={value === m.id}
            title={m.name}
            aria-label={m.name}
            className="swatch"
            style={swatchBackground(m)}
            onClick={() => onPick(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** A colour input; commits on release so one drag is one undo step. */
export function ColorField({ label, value, onCommit }: { label: string; value: string; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Row label={label}>
      <input
        type="color"
        className="f-color"
        aria-label={label}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft && draft !== value) onCommit(draft);
          setDraft(null);
        }}
      />
    </Row>
  );
}

