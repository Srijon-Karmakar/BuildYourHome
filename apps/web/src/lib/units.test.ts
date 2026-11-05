import { describe, expect, it } from 'vitest';
import { defaultInputUnit, formatArea, formatFeetInches, formatFieldLength, formatLength, formatMetres, parseLength } from './units';

describe('parseLength', () => {
  it('reads plain numbers as metres', () => {
    expect(parseLength('3.5')).toBe(3.5);
    expect(parseLength(' 2 ')).toBe(2);
    expect(parseLength('3,5')).toBe(3.5); // decimal comma
    expect(parseLength('.9')).toBeCloseTo(0.9);
  });

  it('understands metric units', () => {
    expect(parseLength('3.5m')).toBe(3.5);
    expect(parseLength('350cm')).toBeCloseTo(3.5);
    expect(parseLength('350 cm')).toBeCloseTo(3.5);
    expect(parseLength('3500mm')).toBeCloseTo(3.5);
  });

  it('understands feet and inches (the way people actually type them)', () => {
    expect(parseLength('12ft')).toBeCloseTo(3.6576);
    expect(parseLength("12'")).toBeCloseTo(3.6576);
    expect(parseLength("12'6\"")).toBeCloseTo(3.81);
    expect(parseLength('12 ft 6 in')).toBeCloseTo(3.81);
    expect(parseLength('6"')).toBeCloseTo(0.1524);
    expect(parseLength('10.5ft')).toBeCloseTo(3.2004);
  });

  it('honours a different default unit for bare numbers', () => {
    expect(parseLength('350', 'cm')).toBeCloseTo(3.5);
    expect(parseLength('12', 'ft')).toBeCloseTo(3.6576);
    expect(parseLength('3m', 'cm')).toBe(3);
  });

  it('rejects nonsense, negatives and empty input', () => {
    for (const bad of ['', '  ', 'abc', '-2', '3.5 apples', '1..2', '12\'6"x', 'm', '--']) {
      expect(parseLength(bad), bad).toBeNull();
    }
  });
});

describe('formatMetres', () => {
  it('trims trailing zeros but keeps real precision', () => {
    expect(formatMetres(3)).toBe('3');
    expect(formatMetres(3.5)).toBe('3.5');
    expect(formatMetres(0.115)).toBe('0.115');
    expect(formatMetres(2.1000001)).toBe('2.1');
    expect(formatMetres(0.30479999)).toBe('0.305');
  });
});

describe('display units', () => {
  it('formats feet and inches the way people write them', () => {
    expect(formatFeetInches(3.81)).toBe("12'6\"");
    expect(formatFeetInches(3.6576)).toBe("12'");
    expect(formatFeetInches(0.1524)).toBe('6"');
    expect(formatFeetInches(0)).toBe('0"');
    expect(formatFeetInches(2.1)).toBe("6'11\"");
    expect(formatFeetInches(0.3048 * 11.99)).toBe("12'"); // rounds up into the next foot
  });

  it('labels, fields and areas follow the unit', () => {
    expect(formatLength(3.5, 'm')).toBe('3.50 m');
    expect(formatLength(3.5, 'ft')).toBe("11'6\"");
    expect(formatFieldLength(3.5, 'm')).toBe('3.5');
    expect(formatFieldLength(2.1, 'ft')).toBe("6'10.7\"");
    expect(formatArea(12.7, 'm')).toBe('12.7 m²');
    expect(formatArea(10, 'ft')).toBe('108 ft²');
  });

  it('what is typed round-trips through the display format', () => {
    for (const m of [0.115, 0.9, 2.1, 3.5, 7.25]) {
      const back = parseLength(formatFieldLength(m, 'ft'), 'ft')!;
      expect(Math.abs(back - m)).toBeLessThan(0.0026); // 0.1 inch
    }
  });

  it('a bare number means feet in feet mode', () => {
    expect(parseLength('12', defaultInputUnit('ft'))).toBeCloseTo(3.6576);
    expect(parseLength('12', defaultInputUnit('m'))).toBe(12);
  });
});
