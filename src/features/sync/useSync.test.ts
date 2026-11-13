import { describe, expect, it } from 'vitest';
import { importMessage, savedAtText } from './useSync';
import type { MergeSummary } from '../../db/backup';

const base = (over: Partial<MergeSummary> = {}): MergeSummary & { kind: 'sync' } => ({
  writes: {},
  added: 0,
  updated: 0,
  deleted: 0,
  conflicts: [],
  incomingDevice: 'pc-1',
  incomingRole: 'pc',
  incomingExportedAt: '2026-11-13T07:41:00.000Z',
  kind: 'sync',
  ...over,
});
const now = new Date('2026-11-13T12:00:00.000Z');

describe('tuonnin viesti', () => {
  it('kertoo, milloin PC tallensi tiedoston', () => {
    const m = importMessage(base({ added: 2 }), '2026-11-12T10:00:00.000Z', now);
    expect(m).toContain('2 uutta');
    expect(m).toContain(`PC tallensi tiedoston ${savedAtText('2026-11-13T07:41:00.000Z', now)}`);
    expect(savedAtText('2026-11-13T07:41:00.000Z', now)).toMatch(/^tänään klo \d{1,2}\.41$/);
  });
  it('sama tiedosto uudelleen → selkeä "Ei uutta" ja ohje odottaa', () => {
    const m = importMessage(base(), '2026-11-13T07:41:00.000Z', now);
    expect(m).toMatch(/^Ei uutta: tiedosto on sama kuin edellisellä kerralla/);
    expect(m).toContain('yritä uudelleen');
  });
  it('uusi tiedosto ilman muutoksia ei ole "Ei uutta" -varoitus', () => {
    expect(importMessage(base(), '2026-11-12T07:41:00.000Z', now)).toMatch(/^Yhdistetty: 0 uutta/);
  });
});
