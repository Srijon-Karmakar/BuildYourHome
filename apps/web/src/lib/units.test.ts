import { describe, expect, it } from 'vitest';
import { formatMetres, parseLength } from './units';

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
