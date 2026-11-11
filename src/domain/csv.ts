// CSV-vienti (SPEC 10): yksi rivi per kerta. UTF-8 BOM ja puolipiste-erotin, jotta
// suomenkielinen Excel avaa tiedoston oikein sarakkeisiin.

import type { ActivityType, Category, FootballDetails, Profile, Session, UUID } from './types';

const CATEGORY_FI: Record<Category, string> = {
  hobby: 'Harrastus',
  school_pe: 'Koululiikunta',
  school_recess: 'Välitunnit',
  commute: 'Koulumatka',
  self_directed: 'Omaehtoinen',
  family: 'Perhe',
  other: 'Muu',
};

export function csvCell(v: string | number | boolean | undefined | null): string {
  const s = v === undefined || v === null ? '' : typeof v === 'boolean' ? (v ? 'kyllä' : 'ei') : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: (string | number | boolean | undefined | null)[][]) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';

const fiDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${Number(day)}.${Number(m)}.${y}`;
};

export function sessionsCsv(input: {
  profiles: Profile[];
  sessions: Session[];
  types: Map<UUID, ActivityType>;
  details: Map<UUID, FootballDetails>;
}): string {
  const names = new Map(input.profiles.map((p) => [p.id, p.name]));
  const header = [
    'Profiili',
    'Päivä',
    'Laji',
    'Kategoria',
    'Kesto (min)',
    'Kevyt (arvio)',
    'Reipas (arvio)',
    'Rasittava (arvio)',
    'Tehon lähde',
    'Lihas',
    'Luusto',
    'Pelatut min',
    'Osallistuminen',
    'Oma joukkue',
    'Vastustaja',
    'Tehdyt',
    'Päästetyt',
    'Turnaus',
    'Pelejä',
    'Suoritusarvio (1–5)',
    'Viihtyminen (1–3)',
    'Tagit',
    'Muistiinpano',
  ];
  const rows = input.sessions
    .filter((s) => !s.deletedAt && names.has(s.profileId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((s) => {
      const t = input.types.get(s.activityTypeId);
      const d = input.details.get(s.id);
      const fd = d && !d.deletedAt ? d : undefined;
      return [
        names.get(s.profileId),
        fiDate(s.date),
        t?.name,
        t ? CATEGORY_FI[t.category] : '',
        s.durationMin,
        s.minutes.light,
        s.minutes.moderate,
        s.minutes.vigorous,
        s.intensitySource === 'manual' ? 'käsin' : 'tehoprofiili',
        s.muscle,
        s.bone,
        s.playedMin,
        fd ? (fd.attendance === 'full' ? 'kokonaan' : 'osittain') : '',
        fd?.team,
        fd?.opponent,
        fd?.goalsFor,
        fd?.goalsAgainst,
        fd?.eventName,
        fd?.games?.length || fd?.gamesCount,
        fd?.parentRating,
        fd?.enjoyment,
        fd?.focusTags.join(', '),
        s.note,
      ];
    });
  return toCsv([header, ...rows]);
}
