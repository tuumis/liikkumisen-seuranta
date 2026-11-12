import { describe, expect, it } from 'vitest';
import { endedBetween, hhmmToMin, planEndMin, reminderText, unconfirmedNow } from './reminders';
import { planned } from './test-helpers';

const today = '2026-11-12';

describe('työpöytätilan muistutukset', () => {
  it('päättymisaika = alku + kesto; ilman kellonaikaa ei päättymisaikaa', () => {
    expect(hhmmToMin('17:30')).toBe(17 * 60 + 30);
    expect(planEndMin({ startTime: '17:30', durationMin: 90 })).toBe(19 * 60);
    expect(planEndMin({ durationMin: 90 })).toBeUndefined();
  });

  it('kuittaamattomat: menneet avoimet + tämän päivän päättyneet', () => {
    const rows = [
      planned({ id: 'a', date: '2026-11-10', durationMin: 60 }),
      planned({ id: 'b', date: '2026-11-11', durationMin: 60, status: 'done' }),
      planned({ id: 'c', date: '2026-11-11', durationMin: 60, status: 'skipped' }),
      planned({ id: 'd', date: today, startTime: '17:00', durationMin: 90 }),
      planned({ id: 'e', date: today, durationMin: 60 }),
      planned({ id: 'f', date: '2026-11-13', startTime: '08:00', durationMin: 30 }),
      planned({ id: 'g', date: '2026-11-09', durationMin: 60, deletedAt: '2026-11-10T10:00:00.000Z' }),
    ];
    expect(unconfirmedNow(rows, today, hhmmToMin('18:00')).map((p) => p.id)).toEqual(['a']);
    expect(unconfirmedNow(rows, today, hhmmToMin('18:30')).map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('juuri päättyneet: vain välillä (from, to] päättyneet tämän päivän avoimet', () => {
    const rows = [
      planned({ id: 'x', date: today, startTime: '17:00', durationMin: 90 }),
      planned({ id: 'y', date: today, startTime: '17:00', durationMin: 90, status: 'done' }),
      planned({ id: 'z', date: '2026-11-11', startTime: '17:00', durationMin: 90 }),
    ];
    expect(endedBetween(rows, today, hhmmToMin('18:29'), hhmmToMin('18:30')).map((p) => p.id)).toEqual(['x']);
    expect(endedBetween(rows, today, hhmmToMin('18:30'), hhmmToMin('18:31'))).toEqual([]);
  });

  it('iltamuistutuksen teksti', () => {
    expect(reminderText({ unconfirmed: 0, arkiNames: [] })).toBeUndefined();
    expect(reminderText({ unconfirmed: 2, arkiNames: [] })).toEqual({ title: 'Kuittaamattomia kertoja', body: '2 kertaa odottaa kuittausta' });
    expect(reminderText({ unconfirmed: 1, arkiNames: ['Eetu'] })!.body).toBe('1 kerta odottaa kuittausta · tämän päivän arkiliikunta tarkistamatta (Eetu)');
    expect(reminderText({ unconfirmed: 0, arkiNames: ['Eetu'] })).toEqual({ title: 'Tarkista arkiliikunta', body: 'Tämän päivän arkiliikunta tarkistamatta (Eetu)' });
  });
});
