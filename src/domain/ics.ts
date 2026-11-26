// Kalenteritiedosto (.ics, RFC 5545) pelikalenterista (19.11.2026): valitut kuukaudet puhelimen tai
// tietokoneen kalenteriin. Muodostetaan laitteella; ei verkkoliikennettä. Tapahtumien tunnisteet (UID)
// ovat pysyviä, joten uudelleenvienti päivittää aiemmin tuodut tapahtumat niissä kalentereissa, jotka
// tunnistavat UID:n (esim. Apple, Outlook).

import { addDays } from './dates';
import { HOME_AWAY_LABEL, LEVEL_LABEL } from './football';
import { clockText, eventTitle, eventWindow, KIND_ICON, KIND_LABEL, teamNameFor, type CalEvent } from './monthCalendar';
import type { ISODate } from './types';

export const ICS_TZID = 'Europe/Helsinki';

/** Suomen aikavyöhyke (EET/EEST, kesäaika maaliskuun viimeisestä sunnuntaista lokakuun viimeiseen). */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${ICS_TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'TZNAME:EEST',
  'DTSTART:19700329T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'TZNAME:EET',
  'DTSTART:19701025T040000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** Tekstiarvon suojaus: \ ; , ja rivinvaihdot. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Rivin taitto 75 tavuun (UTF-8); jatkorivi alkaa välilyönnillä. Monitavuista merkkiä ei katkaista. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length ? 74 : 75; // jatkorivillä välilyönti vie yhden tavun
    if (bytes + n > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

const ymd = (d: ISODate) => d.replace(/-/g, '');
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`;

/** Paikallinen aika vyöhykkeineen; yli vuorokauden menevä loppu siirtyy seuraavalle päivälle. */
function localStamp(date: ISODate, min: number): string {
  const day = Math.floor(min / (24 * 60));
  return `${ymd(addDays(date, day))}T${hm(min - day * 24 * 60)}`;
}

/** UTC-aikaleima (DTSTAMP). */
export const utcStamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '').replace(/Z?$/, 'Z');

export interface IcsOptions {
  /** Kalenterin nimi (X-WR-CALNAME). */
  calName: string;
  /** Vientihetki (ISO-aikaleima), DTSTAMP ja SEQUENCE. */
  now: string;
  /** Tapahtuman nimen etuliite (perheessä lapsi tai joukkue). */
  prefix?: (e: CalEvent) => string | undefined;
  /** Tulokset nimeen ja kuvaukseen. */
  results: boolean;
}

/** Tapahtuman nimi kalenteriin: "⚽ PK-35 Valkoinen 2017 (vieras)", pelatussa tulos perään. */
export function icsSummary(e: CalEvent, opts: Pick<IcsOptions, 'prefix' | 'results'>): string {
  const title = e.kind === 'friendly' && (e.opponents?.length ?? 0) > 0 ? `Harjoituspeli: ${eventTitle(e, 'compact')}` : eventTitle(e, 'compact');
  const ha = e.homeAway ? ` (${HOME_AWAY_LABEL[e.homeAway].toLowerCase()})` : '';
  if (e.kind === 'note') {
    const prefix = opts.prefix?.(e);
    return `${prefix ? `${prefix}: ` : ''}${KIND_ICON.note} ${e.title}`;
  }
  const result = opts.results && e.result ? ` ${e.result}` : '';
  const skipped = e.state === 'skipped' ? ' – ei pelattu' : '';
  const prefix = opts.prefix?.(e);
  return `${prefix ? `${prefix}: ` : ''}${KIND_ICON[e.kind]} ${title}${ha}${result}${skipped}`;
}

/** Kuvaus: aikataulu, sarja ja taso, otteluohjelma, tulos, puuttuvat tiedot ja linkki. */
export function icsDescription(e: CalEvent, opts: Pick<IcsOptions, 'results'>): string {
  const lines: string[] = [];
  if (e.kind === 'note') return [KIND_LABEL.note, e.family && 'Koko perhe'].filter(Boolean).join('\n');
  if (e.kind !== 'training') lines.push(KIND_LABEL[e.kind]);
  if (e.arrival && e.state !== 'played') lines.push(`Paikalla klo ${clockText(e.arrival)}`);
  if (e.time && e.kind !== 'training') lines.push(`${e.kind === 'tournament' ? 'Ensimmäinen peli' : 'Alkaa'} klo ${clockText(e.time)}`);
  const meta = [e.series, e.level && LEVEL_LABEL[e.level], e.homeAway && HOME_AWAY_LABEL[e.homeAway]].filter(Boolean);
  if (meta.length) lines.push(meta.join(' · '));
  for (const [i, g] of (e.games ?? []).entries()) {
    lines.push(
      `${i + 1}. ${[clockText(g.time), g.opponent ? teamNameFor(g.opponent, 'compact') : 'vastustaja ?', g.homeAway && HOME_AWAY_LABEL[g.homeAway].toLowerCase(), g.location, opts.results && g.result]
        .filter(Boolean)
        .join(' · ')}`,
    );
  }
  if (opts.results && e.result) lines.push(`Tulos ${e.result}`);
  if (e.state === 'skipped') lines.push('Ei pelattu');
  if (e.infoMissing) lines.push(`Tietoja puuttuu${e.missingNote ? `: ${e.missingNote}` : ''}`);
  if (e.link) lines.push(e.link);
  return lines.join('\n');
}

/** Koko kalenteritiedosto CRLF-rivein. */
export function buildIcs(events: CalEvent[], opts: IcsOptions): string {
  const stamp = utcStamp(opts.now);
  // Kasvava järjestysnumero vientihetkestä: uudempi vienti korvaa aiemmin tuodun version.
  const sequence = Math.max(0, Math.floor((Date.parse(opts.now) - Date.UTC(2026, 0, 1)) / 60000));
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Liikkumisen seuranta//Pelikalenteri//FI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(opts.calName)}`, `X-WR-TIMEZONE:${ICS_TZID}`, ...VTIMEZONE];
  for (const e of events) {
    const w = eventWindow(e);
    out.push('BEGIN:VEVENT', `UID:${e.key}@liikkumisen-seuranta`, `DTSTAMP:${stamp}`, `SEQUENCE:${sequence}`);
    if (w) out.push(`DTSTART;TZID=${ICS_TZID}:${localStamp(e.date, w.start)}`, `DTEND;TZID=${ICS_TZID}:${localStamp(e.date, w.end)}`);
    else out.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(addDays(e.date, 1))}`);
    out.push(`SUMMARY:${icsEscape(icsSummary(e, opts))}`);
    if (e.location) out.push(`LOCATION:${icsEscape(e.location)}`);
    const desc = icsDescription(e, opts);
    if (desc) out.push(`DESCRIPTION:${icsEscape(desc)}`);
    if (e.link) out.push(`URL:${e.link}`);
    if (e.state === 'skipped') out.push('STATUS:CANCELLED');
    out.push('END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.map(icsFold).join('\r\n') + '\r\n';
}
