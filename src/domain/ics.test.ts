import { describe, expect, it } from 'vitest';
import { buildIcs, icsEscape, icsFold, icsSummary } from './ics';
import { clashes, eventWindow, mergeProfileEvents, monthEvents, windowText, type CalEvent } from './monthCalendar';

const ev = (o: Partial<CalEvent>): CalEvent => ({ key: 'k', date: '2026-11-21', kind: 'game', state: 'upcoming', title: 'x', ...o });
const NOW = '2026-11-19T10:00:00.000Z';

describe('.ics', () => {
  it('ottelu: alku paikalla-ajasta, loppu aloitus + kesto, Suomen aikavyöhyke', () => {
    const ics = buildIcs(
      [ev({ key: 'p1', time: '10:00', arrival: '09:15', durationMin: 90, opponents: ['PK-35 · Valkoinen · 2017'], title: 'PK-35', homeAway: 'away', location: 'Tali 2, kenttä 3', series: 'P9', link: 'https://example.org/peli' })],
      { calName: 'Pelikalenteri', now: NOW, results: true },
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:p1@liikkumisen-seuranta');
    expect(ics).toContain('DTSTART;TZID=Europe/Helsinki:20261121T091500');
    expect(ics).toContain('DTEND;TZID=Europe/Helsinki:20261121T113000');
    expect(ics).toContain('SUMMARY:⚽ PK-35 Valkoinen 2017 (vieras)');
    expect(ics).toContain('LOCATION:Tali 2\\, kenttä 3');
    expect(ics).toContain('URL:https://example.org/peli');
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics).toContain('DTSTAMP:20261119T100000Z');
  });

  it('ilman aikaa koko päivän tapahtuma; ei pelattu peruttuna; tulos nimeen', () => {
    const ics = buildIcs(
      [
        ev({ key: 't', kind: 'tournament', title: 'Talvicup', date: '2026-11-28' }),
        ev({ key: 's', state: 'skipped', title: 'HJK', date: '2026-11-10' }),
        ev({ key: 'r', state: 'played', title: 'Ilves', result: '3–1 V', time: '17:00', durationMin: 60 }),
      ],
      { calName: 'x', now: NOW, results: true, prefix: () => 'Aino' },
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261128');
    expect(ics).toContain('DTEND;VALUE=DATE:20261129');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('SUMMARY:Aino: ⚽ Ilves 3–1 V');
  });

  it('tulokset pois valittaessa; harjoituspeli nimettynä', () => {
    expect(icsSummary(ev({ state: 'played', title: 'Ilves', result: '3–1 V' }), { results: false })).toBe('⚽ Ilves');
    expect(icsSummary(ev({ kind: 'friendly', title: 'TPV, Ilves', opponents: ['TPV', 'Ilves'] }), { results: true })).toBe('🤝 Harjoituspeli: TPV, Ilves');
  });

  it('suojaus ja rivien taitto 75 tavuun (ääkköset ja emojit eivät katkea)', () => {
    expect(icsEscape('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
    const long = `SUMMARY:${'ä'.repeat(60)}⚽${'ö'.repeat(30)}`;
    const folded = icsFold(long);
    const enc = new TextEncoder();
    for (const l of folded.split('\r\n')) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(long);
  });

  it('yli puolenyön päättyvä tapahtuma päättyy seuraavana päivänä', () => {
    const ics = buildIcs([ev({ time: '23:00', durationMin: 120 })], { calName: 'x', now: NOW, results: false });
    expect(ics).toContain('DTEND;TZID=Europe/Helsinki:20261122T010000');
  });
});

describe('perhekalenteri', () => {
  it('yhdistää profiilit ja tunnistaa päällekkäiset eri lasten tapahtumat', () => {
    const a = new Map([['2026-11-21', [ev({ key: 'a1', time: '10:00', arrival: '09:15', durationMin: 90 })]]]);
    const b = new Map([
      [
        '2026-11-21',
        [ev({ key: 'b1', kind: 'tournament', time: '11:00', arrival: '10:30', durationMin: 240 }), ev({ key: 'b2', kind: 'training', state: 'planned', time: '18:00', durationMin: 60 })],
      ],
    ]);
    const merged = mergeProfileEvents([
      { profileId: 'A', events: a },
      { profileId: 'B', events: b },
    ]);
    const day = merged.get('2026-11-21')!;
    expect(day.map((e) => `${e.profileId}:${e.key}`)).toEqual(['A:a1', 'B:b1', 'B:b2']);
    expect(clashes(day).map(([x, y]) => `${x.key}-${y.key}`)).toEqual(['a1-b1']);
    expect(eventWindow(day[1])).toEqual({ start: 630, end: 870 });
    expect(windowText(day[0])).toBe('9.15–11.30');
  });

  it('ilman aikaa = tarkistettava koko päivä; saman lapsen päällekkäisyys ei ole varoitus', () => {
    const day = [ev({ key: 'x', profileId: 'A' }), ev({ key: 'y', profileId: 'B', time: '12:00' }), ev({ key: 'z', profileId: 'B', time: '12:30' })];
    expect(clashes(day).map(([p, q]) => `${p.key}-${q.key}`)).toEqual(['x-y', 'x-z']);
    expect(clashes([ev({ key: 'x', profileId: 'A', state: 'skipped' }), ev({ key: 'y', profileId: 'B' })])).toEqual([]);
  });
});

describe('kalenterimerkinnät kalenterissa (27.11.2026)', () => {
  const note = (o: object) => ({ id: 'n1', date: '2026-11-21', title: 'Hammaslääkäri', createdAt: 't', updatedAt: 't', updatedBy: 'd', ...o });
  it('merkinnästä tapahtuma; koko perheen merkintä kerran ilman profiilia; ei päällekkäisyysvaroitusta', () => {
    const own = monthEvents({ today: '2026-11-20', fixtures: [], rows: [], notes: [note({ profileId: 'A', startTime: '14:30', endTime: '15:15' })] }).get('2026-11-21')!;
    expect(own[0]).toMatchObject({ kind: 'note', state: 'planned', time: '14:30', durationMin: 45, title: 'Hammaslääkäri' });
    expect(own[0].family).toBeUndefined();
    const fam = note({ id: 'f1', title: 'Mummolaan' });
    const merged = mergeProfileEvents([
      { profileId: 'A', events: monthEvents({ today: '2026-11-20', fixtures: [], rows: [], notes: [fam] }) },
      { profileId: 'B', events: new Map([['2026-11-21', [ev({ key: 'g', time: '12:00' }), ...monthEvents({ today: '2026-11-20', fixtures: [], rows: [], notes: [fam] }).get('2026-11-21')!]]]) },
    ]);
    const day = merged.get('2026-11-21')!;
    expect(day.map((e) => `${e.profileId ?? '-'}:${e.key}`)).toEqual(['B:g', '-:f1']);
    const timedNote = { ...ev({ key: 'n', kind: 'note', state: 'planned', time: '12:00' }), profileId: 'A' };
    expect(clashes([...day, timedNote])).toEqual([]);
    expect(eventWindow(timedNote)).toEqual({ start: 720, end: 780 });
  });

  it('.ics: merkinnän nimi ja kuvaus', () => {
    const e = ev({ key: 'f1', kind: 'note', state: 'planned', title: 'Mummolaan', family: true, location: 'Mummola', memo: 'Kakku mukaan' });
    expect(icsSummary(e, { results: true, prefix: () => undefined })).toBe('📅 Mummolaan');
    const ics = buildIcs([e], { calName: 'x', now: NOW, results: true });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261121');
    expect(ics).toContain('LOCATION:Mummola');
    expect(ics).toContain('Kakku mukaan');
    expect(ics).toContain('DESCRIPTION:Muu merkintä\\nKoko perhe');
  });
});
