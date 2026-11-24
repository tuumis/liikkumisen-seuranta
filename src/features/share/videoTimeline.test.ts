import { describe, expect, it } from 'vitest';
import { MAX_TOTAL, MIN_TOTAL, poseAt, videoTimeline } from './videoTimeline';

describe('tempo ja pituus (24.11.2026)', () => {
  const names = ['bg', 'kicker', 'date', 'team', 'opponent', 'vs', 'times', 'place'];
  it('nopea tempo aikaistaa osia ja hidas myöhentää; normaali = oletus', () => {
    const fast = videoTimeline(names, { tempo: 'fast', length: 'normal' }).anims.get('vs')!;
    const normal = videoTimeline(names).anims.get('vs')!;
    const slow = videoTimeline(names, { tempo: 'slow', length: 'normal' }).anims.get('vs')!;
    expect(fast.start).toBeLessThan(normal.start);
    expect(slow.start).toBeGreaterThan(normal.start);
    expect(videoTimeline(names, { tempo: 'normal', length: 'normal' })).toEqual(videoTimeline(names));
  });
  it('pituus: lyhyt < normaali < pitkä; animaatio ei katkea', () => {
    const t = (length: 'short' | 'normal' | 'long', tempo: 'slow' | 'fast' = 'fast') => videoTimeline(names, { tempo, length }).total;
    expect(t('short')).toBeLessThan(t('normal'));
    expect(t('normal')).toBeLessThan(t('long'));
    const rows = Array.from({ length: 20 }, (_, k) => `row:${k}`);
    const long = videoTimeline(['bg', 'title', ...rows, 'place'], { tempo: 'slow', length: 'short' });
    const end = Math.max(...[...long.anims.values()].map((a) => a.start + a.dur));
    expect(long.total).toBeGreaterThan(end);
  });
});

describe('videoTimeline', () => {
  it('ottelu: tunniste ja päivä ensin, joukkueet yhtä aikaa vastakkaisilta puolilta, VS niiden jälkeen', () => {
    const { anims, total } = videoTimeline(['bg', 'kicker', 'date', 'team', 'opponent', 'team', 'opponent', 'vs', 'times', 'place']);
    const kicker = anims.get('kicker')!;
    const date = anims.get('date')!;
    const team = anims.get('team')!;
    const opp = anims.get('opponent')!;
    const vs = anims.get('vs')!;
    expect(kicker.start).toBeLessThan(date.start);
    expect(date.start).toBeLessThan(team.start);
    expect(team.start).toBe(opp.start);
    expect([team.kind, opp.kind, vs.kind]).toEqual(['left', 'right', 'pop']);
    expect(vs.start).toBeGreaterThan(team.start);
    expect(anims.get('times')!.start).toBeLessThan(anims.get('place')!.start);
    expect(anims.has('bg')).toBe(false);
    expect(total).toBeGreaterThanOrEqual(MIN_TOTAL);
    expect(total).toBeLessThan(8);
  });

  it('turnaus: rivit yksi kerrallaan ja laatikot rivien jälkeen; pitkä lista pidentää videota', () => {
    const rows = Array.from({ length: 14 }, (_, k) => `row:${k}`);
    const { anims, total } = videoTimeline(['bg', 'kicker', 'title', 'date', 'team', 'label', ...rows, 'comment', 'times', 'place']);
    const starts = rows.map((r) => anims.get(r)!.start);
    expect(starts.every((s, i) => i === 0 || s > starts[i - 1])).toBe(true);
    expect(anims.get('times')!.start).toBeGreaterThan(starts[starts.length - 1]);
    expect(total).toBeGreaterThan(MIN_TOTAL);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL);
  });

  it('asento: ennen alkua näkymätön, lopussa paikallaan', () => {
    const { anims } = videoTimeline(['team', 'vs']);
    const team = anims.get('team')!;
    expect(poseAt(team, 0, 1080).alpha).toBe(0);
    expect(poseAt(team, team.start + team.dur / 2, 1080).dx).toBeLessThan(0);
    expect(poseAt(team, 10, 1080)).toEqual({ alpha: 1, dx: 0, dy: 0, scale: 1 });
    expect(poseAt(anims.get('vs'), 10, 1080).scale).toBe(1);
    expect(poseAt(undefined, 0, 1080).alpha).toBe(1);
  });
});
