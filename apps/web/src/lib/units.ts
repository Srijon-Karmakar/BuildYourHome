/**
 * Length parsing and formatting. The scene stores metres (ADR-006); people type whatever they know.
 * Accepts: `3.5`, `3,5`, `3.5m`, `350cm`, `3500 mm`, `12ft`, `12'`, `12'6"`, `12 ft 6 in`, `6"`.
 * A bare number uses `defaultUnit`. Returns metres, or null when the text is not a usable length.
 */
export type LengthUnit = 'm' | 'cm' | 'mm' | 'ft' | 'in';

const TO_M: Record<LengthUnit, number> = { m: 1, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254 };

const UNIT_ALIASES: Record<string, LengthUnit> = {
  m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  cm: 'cm', mm: 'mm',
  ft: 'ft', feet: 'ft', foot: 'ft', "'": 'ft', '′': 'ft',
  in: 'in', inch: 'in', inches: 'in', '"': 'in', '″': 'in',
};

const NUMBER = '(\\d+(?:[.,]\\d+)?|[.,]\\d+)';
const PART = new RegExp(`${NUMBER}\\s*([a-zA-Z"'′″]*)`, 'g');

export function parseLength(input: string, defaultUnit: LengthUnit = 'm'): number | null {
  const text = input.trim().toLowerCase();
  if (!text || text.startsWith('-')) return null;

  let total = 0;
  let consumed = 0;
  let parts = 0;
  PART.lastIndex = 0;
  for (let m = PART.exec(text); m; m = PART.exec(text)) {
    // Everything must be accounted for (reject "3.5 apples", "1..2" etc).
    if (text.slice(consumed, m.index).trim() !== '') return null;
    consumed = m.index + m[0].length;
    const value = Number(m[1]!.replace(',', '.'));
    const unitText = m[2]!;
    const unit = unitText === '' ? defaultUnit : UNIT_ALIASES[unitText];
    if (!unit || !Number.isFinite(value)) return null;
    total += value * TO_M[unit];
    parts++;
  }
  if (parts === 0 || text.slice(consumed).trim() !== '') return null;
  return total;
}

/** Trim trailing zeros: 3.5 → "3.5", 2.1 → "2.1", 0.115 → "0.115", 3 → "3". */
export function formatMetres(m: number, maxDecimals = 3): string {
  return String(Number(m.toFixed(maxDecimals)));
}
