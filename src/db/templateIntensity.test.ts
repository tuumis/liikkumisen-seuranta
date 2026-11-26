// Viikkorytmin teho valmiiksi (26.11.2026): pohjarivi → suunnitelmat → kuittaus ja ennuste.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { activityTypeId, plannedSessionId } from '../domain/ids';
import { INTENSITY_PRESETS, plannedMinutes } from '../domain/intensity';
import { templateItemSchema } from '../domain/schemas';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`tint-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const SWIM = activityTypeId('other');
const TODAY = '2026-11-23'; // ma

describe('viikkorytmin teho', () => {
  it('siirtyy suunnitelmiin, kuittaukseen ja ennusteeseen; kuitatessa voi valita lajin arvion', async () => {
    const item = await repo.createTemplateItem('p1', { activityTypeId: SWIM, weekdays: [1, 3], durationMin: 60, validFrom: '2026-11-01', intensityPreset: 'vigorous' }, TODAY);
    expect(item.intensityPreset).toBe('vigorous');
    await repo.ensurePlanned('p1', '2026-11-29', TODAY);
    const mon = (await db.plannedSessions.get(plannedSessionId(item.id, TODAY)))!;
    expect(mon.intensityPreset).toBe('vigorous');

    const type = (await repo.listActivityTypes()).find((t) => t.id === SWIM)!;
    const shares = INTENSITY_PRESETS.vigorous;
    expect(plannedMinutes(type, mon)).toEqual({ light: Math.round(60 * shares.light), moderate: Math.round(60 * shares.moderate), vigorous: Math.round(60 * shares.vigorous) });

    // Pikakuittaus: viikkorytmin teho.
    const a = await repo.confirmPlanned(mon.id, TODAY);
    expect(a.session.intensityPreset).toBe('vigorous');
    expect(a.session.minutes.vigorous).toBe(30);

    // Kuittaus lisätiedoilla, valittuna lajin arvio (null).
    const wed = plannedSessionId(item.id, '2026-11-25');
    const b = await repo.confirmPlanned(wed, '2026-11-25', { intensityPreset: null });
    expect(b.session.intensityPreset).toBeUndefined();
  });

  it('muutos viikkorytmissä päivittää tulevat avoimet kerrat; kuitattu ja yksittäin muutettu säilyvät', async () => {
    const item = await repo.createTemplateItem('p1', { activityTypeId: SWIM, weekdays: [1, 3, 5], durationMin: 60, validFrom: '2026-11-01' }, TODAY);
    await repo.ensurePlanned('p1', '2026-11-29', TODAY);
    await repo.confirmPlanned(plannedSessionId(item.id, TODAY), TODAY);
    await repo.updatePlannedOccurrence(plannedSessionId(item.id, '2026-11-27'), { durationMin: 45 });

    await repo.updateTemplateItem(item.id, { activityTypeId: SWIM, weekdays: [1, 3, 5], durationMin: 60, validFrom: '2026-11-01', intensityPreset: 'light' }, TODAY);
    const get = async (d: string) => (await db.plannedSessions.get(plannedSessionId(item.id, d)))!;
    expect((await get('2026-11-25')).intensityPreset).toBe('light');
    expect((await get(TODAY)).intensityPreset).toBeUndefined(); // kuitattu
    expect((await get('2026-11-27')).intensityPreset).toBeUndefined(); // yksittäin muutettu

    // Takaisin lajin arvioon.
    await repo.updateTemplateItem(item.id, { activityTypeId: SWIM, weekdays: [1, 3, 5], durationMin: 60, validFrom: '2026-11-01' }, TODAY);
    expect('intensityPreset' in (await get('2026-11-25'))).toBe(false);
  });

  it('tuntematon arvo luetaan lajin arvioksi', () => {
    const r = templateItemSchema.safeParse({
      id: 'x',
      profileId: 'p1',
      activityTypeId: SWIM,
      weekdays: [1],
      durationMin: 60,
      validFrom: '2026-11-01',
      active: true,
      intensityPreset: 'extreme',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      updatedBy: 'd',
    });
    expect(r.success).toBe(true);
    expect((r.data as { intensityPreset?: string }).intensityPreset).toBeUndefined();
  });
});
