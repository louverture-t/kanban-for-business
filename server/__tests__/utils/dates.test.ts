import { describe, it, expect } from 'vitest';
import { toISO } from '@server/utils/dates.js';

describe('toISO', () => {
  it('returns null for null and undefined', () => {
    expect(toISO(null)).toBeNull();
    expect(toISO(undefined)).toBeNull();
  });

  it('serializes a valid Date to ISO-8601 (primary resolver path)', () => {
    const d = new Date('2026-04-15T00:00:00.000Z');
    expect(toISO(d)).toBe('2026-04-15T00:00:00.000Z');
  });

  it('returns null for an invalid Date', () => {
    expect(toISO(new Date('not-a-date'))).toBeNull();
  });

  it('accepts epoch-ms numbers', () => {
    const iso = '2026-04-15T00:00:00.000Z';
    const epochMs = new Date(iso).getTime();
    expect(toISO(epochMs)).toBe(iso);
  });

  it('accepts ISO strings', () => {
    expect(toISO('2026-04-15T00:00:00.000Z')).toBe('2026-04-15T00:00:00.000Z');
  });

  it('returns null for unparseable strings', () => {
    expect(toISO('definitely not a date')).toBeNull();
  });
});
