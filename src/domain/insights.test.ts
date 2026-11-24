// Viikon huomiot (SPEC 16, 20.11.2026): datan portti, suosituksen vajeet, järjestys, vaihtoehto ja toisto.
import { describe, expect, it } from 'vitest';
import { addDays, datesBetween, weekPeriod } from './dates';
import { activityTypeId } from './ids';
import { freeWeekdays, listFi, weekInsights } from './insights';
import { DEFAULT_SETTINGS } from './recommendations';
import { periodReport, type ReportInput } from './report';
import { planned, profile, session, typesMap, TS, DEV } from './test-helpers';
import type { DayFlag, Session, TemplateItem } from './types';

const types = typesMap();
const MON = '2026-11-09';
const TODAY = '2026-11-16';
const kid = profile({ createdAt: '2026-09-01T10:00:00.000Z', birthYear: 2016, birthMonth: 5 });
const small = profile({ createdAt: '2026-09-01T10:00:00.000Z', birthYear: 2022, birthMonth: 5 });

const report = (mon: string, sessions: Session[], over: Partial<ReportInput> = {}) =>
  periodReport({
    profile: kid,
    period: weekPeriod(mon),
    sessions,
    estimates: [],
    flags: [],
    planned: [],
    types,
    settings: { ...DEFAULT_SETTINGS },
    today: TODAY,
    ...over,
  });

/** Viikko, jolla joka päivä `mod` min reipasta; rasittavat päivät ja vahvistavat päivät indekseinä (0 = ma). */
function week(mon: string, mod: number, vig: number[] = [], strong: number[] = []): Session[] {
  return datesBetween(mon, addDays(mon, 6)).map((date, i) =>
    session({ date, minutes: { light: 10, moderate: mod, vigorous: vig.includes(i) ? 25 : 0 }, muscle: strong.includes(i), bone: strong.includes(i) }),
  );
}

const item = (weekdays: TemplateItem['weekdays'], typeKey = 'football_training'): TemplateItem => ({
  id: `t${weekdays.join('')}`,
  profileId: 'p1',
  activityTypeId: activityTypeId(typeKey),
  weekdays,
  durationMin: 60,
  validFrom: '2026-09-01',
  active: true,
  createdAt: TS,
  updatedAt: TS,
  updatedBy: DEV,
});

describe('viikon huomiot', () => {
  it('portti: kesken oleva viikko, kuittaamattomat, vajaa viikko', () => {
    expect(weekInsights({ report: report(MON, week(MON, 70), { today: '2026-11-15' }), today: '2026-11-15', types }).state).toBe('current');
    const open = planned({ date: '2026-11-11' });
    expect(weekInsights({ report: report(MON, week(MON, 70), { planned: [open] }), today: TODAY, types })).toMatchObject({ state: 'pending', unconfirmed: 1 });
    const sick = ['2026-11-09', '2026-11-10', '2026-11-11'].map(
      (date): DayFlag => ({ id: `f:p1:${date}`, profileId: 'p1', date, reason: 'sick', updatedAt: TS, updatedBy: DEV }),
    );
    expect(weekInsights({ report: report(MON, week(MON, 70), { flags: sick }), today: TODAY, types })).toMatchObject({ state: 'partial', validDays: 4 });
  });

  it('hyvä viikko: ei huomioita', () => {
    const r = weekInsights({ report: report(MON, week(MON, 70, [1, 3, 5], [0, 2, 4])), today: TODAY, types });
    expect(r.state).toBe('ok');
    expect(r.insights).toEqual([]);
  });

  it('koululainen: pääluku, rasittavat ja vahvistavat päivät järjestyksessä; vaihtoehto viikkorytmistä', () => {
    const r = weekInsights({
      report: report(MON, week(MON, 40, [1])),
      today: TODAY,
      types,
      templateItems: [item([1, 3]), item([2], 'school_pe')],
    });
    expect(r.state).toBe('insights');
    expect(r.insights.map((i) => i.id)).toEqual(['mvpa_avg', 'vigorous_days', 'strength_days']);
    expect(r.insights[1].title).toBe('Rasittavaa liikuntaa 1 päivänä (ti)');
    // Koululiikunta ei ole harrastus: ti on vapaa.
    expect(r.insights[0].option).toBe('Viikkorytmissä harrastuksettomia päiviä: ti, to, pe, la ja su.');
    expect(r.insights[1].option).toBeUndefined();
    expect(r.insights[2].title).toBe('Lihaksia vahvistavaa 0 ja luustoa vahvistavaa 0 päivänä');
    expect(r.insights[2].text).toContain('kumpaakin vähintään 3');
    expect(r.insights.every((i) => i.tier === 'official' && i.source.title)).toBe(true);
  });

  it('keskiarvo täyttyi mutta päiviä jäi alle tunnin', () => {
    const s = week(MON, 40, [3, 5, 6], [0, 2, 4]).map((x, i) => (i >= 3 ? { ...x, minutes: { light: 10, moderate: 90, vigorous: x.minutes.vigorous } } : x));
    const r = weekInsights({ report: report(MON, s), today: TODAY, types });
    expect(r.insights.map((i) => i.id)).toEqual(['mvpa_days']);
    expect(r.insights[0].title).toBe('Keskiarvo täyttyi, mutta 3 päivää jäi alle tunnin (ma, ti ja ke)');
  });

  it('toisto: sama vaje kolmena viikkona peräkkäin', () => {
    const prev1 = report('2026-11-02', week('2026-11-02', 70, [1], [0, 2, 4]));
    const prev2 = report('2026-10-26', week('2026-10-26', 70, [], [0, 2, 4]));
    const r = weekInsights({ report: report(MON, week(MON, 70, [1], [0, 2, 4])), previous: [prev1, prev2], today: TODAY, types });
    expect(r.insights.map((i) => [i.id, i.streak])).toEqual([['vigorous_days', 3]]);
    // Väliin jäänyt viikko katkaisee toiston.
    const r2 = weekInsights({ report: report(MON, week(MON, 70, [1], [0, 2, 4])), previous: [undefined, prev2], today: TODAY, types });
    expect(r2.insights[0].streak).toBeUndefined();
  });

  it('alle kouluikäinen: arki vs. viikonloppu ja puuttuva osa', () => {
    const s = datesBetween(MON, addDays(MON, 6)).map((date, i) =>
      session({ date, durationMin: i < 5 ? 200 : 190, minutes: i < 5 ? { light: 130, moderate: 50, vigorous: 20 } : { light: 160, moderate: 25, vigorous: 5 } }),
    );
    const r = weekInsights({ report: report(MON, s, { profile: small }), today: TODAY, types });
    expect(r.insights.map((i) => i.id)).toEqual(['ey_days']);
    expect(r.insights[0].title).toBe('Päivän tavoite täyttyi 5/7 päivänä (vajaat: la ja su)');
    expect(r.insights[0].text).toContain('Arkipäivinä tavoite täyttyi, viikonloppuna ei.');
    expect(r.insights[0].text).toContain('vauhdikasta (reipasta ja rasittavaa) jäi alle tunnin');
  });

  it('apufunktiot', () => {
    expect(listFi(['ma'])).toBe('ma');
    expect(listFi(['ma', 'ti', 'ke'])).toBe('ma, ti ja ke');
    expect(freeWeekdays([], types, MON)).toEqual([]);
    expect(freeWeekdays([{ ...item([1, 2]), validTo: '2026-11-01' }, item([5])], types, MON)).toEqual([1, 2, 3, 4, 6, 7]);
  });
});
