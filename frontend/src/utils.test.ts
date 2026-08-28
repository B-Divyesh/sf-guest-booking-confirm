import { describe, expect, it } from 'vitest';
import { escapeHtml, formatDate, safeTimezone, statusMeta } from './utils';

describe('booking display helpers', () => {
  it('gives each state explicit copy', () => expect(statusMeta.confirmed.label).toBe('Confirmed'));
  it('formats in the business timezone', () => expect(formatDate('2026-01-15T12:00:00Z', 'Asia/Kolkata')).toContain('5:30'));
  it('escapes guest data', () => expect(escapeHtml('<script>')).toBe('&lt;script&gt;'));
  it('rejects invented timezones', () => expect(safeTimezone('Moon/Base')).toBe(false));
});
