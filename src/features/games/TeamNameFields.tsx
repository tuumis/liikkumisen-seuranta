// Joukkueen nimi kolmena kenttänä (SPEC 16): seura, ryhmä ja ikäluokka. Arvo on yksi teksti
// ("FC Honka · Musta · 2018"), joten kentät sopivat sekä vastustajalle että omalle joukkueelle.
// Ehdotukset tulevat aiemmista peleistä, omista joukkueista ja seurakirjastosta. Seuran tunnetut
// ryhmät (peleistä ja seuralle tallennetut, 17.11.2026) näkyvät valintasiruina: napautus täyttää
// ryhmän ja ikäluokan, joten niitä ei tarvitse kirjoittaa uudelleen. Seurakenttä ehdottaa lisäksi
// Palloliiton jäsenseurat (domain/finnishClubs, 17.11.2026): oman kotikunnan ja alueen seurat ensin.

import { useEffect, useId, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ageLabel, clubKey, formatTeamName, parseTeamName, squadKey, type TeamParts } from '../../domain/opponent';
import { clubLabel, findFinnishClub, homeOf, rankedFinnishClubs } from '../../domain/finnishClubs';
import type { UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { inputClass } from '../../ui/components';

export interface ClubOption {
  value: string;
  /** Selite ehdotuslistassa, esim. "Kuopion Palloseura · Kuopio". */
  label?: string;
}

export interface TeamNameSuggestions {
  /** Omat ja peleistä tutut seurat. */
  clubs: string[];
  /** Seurakentän ehdotukset: tutut seurat ja Palloliiton jäsenseurat (oma alue ensin). */
  clubOptions: ClubOption[];
  /** Seuran avain → ryhmät ja ikäluokat. */
  groups: Map<string, string[]>;
  ages: Map<string, string[]>;
  /** Seuran avain → tunnetut ryhmä + ikäluokka -yhdistelmät (tallennetut ensin). */
  squads: Map<string, TeamParts[]>;
}

export function useTeamNameSuggestions(profileId: UUID | undefined): TeamNameSuggestions | undefined {
  const data = useLiveQuery(async () => {
    if (!profileId) return undefined;
    const [names, clubs, teams] = await Promise.all([repo.footballNameSuggestions(profileId), repo.listClubs(), repo.listTeams(profileId, { includeArchived: true })]);
    return {
      own: [...names.teams, ...teams.map((t) => t.name)],
      names: [...names.opponents, ...names.teams, ...teams.map((t) => t.name)],
      clubs: clubs.map((c) => c.name),
      saved: clubs.flatMap((c) => (c.squads ?? []).map((q) => ({ club: c.name, ...q }))),
    };
  }, [profileId]);
  return useMemo(() => {
    if (!data) return undefined;
    const clubs = new Map<string, string>();
    const groups = new Map<string, Set<string>>();
    const ages = new Map<string, Set<string>>();
    const squads = new Map<string, Map<string, TeamParts>>();
    const add = (m: Map<string, Set<string>>, k: string, v?: string) => v && (m.get(k) ?? m.set(k, new Set()).get(k)!).add(v);
    const addSquad = (k: string, p: TeamParts) => {
      if (!p.group && !p.age) return;
      const m = squads.get(k) ?? squads.set(k, new Map()).get(k)!;
      const sk = squadKey(p);
      if (!m.has(sk)) m.set(sk, { club: p.club, ...(p.group ? { group: p.group } : {}), ...(p.age ? { age: p.age } : {}) });
    };
    for (const c of data.clubs) clubs.set(clubKey(c), c);
    for (const q of data.saved) {
      const k = clubKey(q.club);
      add(groups, k, q.group);
      add(ages, k, q.age);
      addSquad(k, q);
    }
    for (const n of data.names) {
      const p = parseTeamName(n);
      if (!p.club) continue;
      const k = clubKey(p.club);
      if (!clubs.has(k)) clubs.set(k, p.club);
      add(groups, k, p.group);
      add(ages, k, p.age);
      addSquad(k, p);
    }
    const sorted = (m: Map<string, Set<string>>) => new Map([...m].map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, 'fi'))]));
    const known = [...clubs.values()].sort((a, b) => a.localeCompare(b, 'fi'));
    const labelOf = (name: string) => {
      const c = findFinnishClub(name);
      return c ? clubLabel(c) : undefined;
    };
    const home = homeOf(data.own.map((n) => parseTeamName(n).club).filter(Boolean));
    const clubOptions: ClubOption[] = [
      ...known.map((value) => ({ value, label: labelOf(value) })),
      ...rankedFinnishClubs(home, new Set(clubs.keys())).map((c) => ({ value: c.name, label: clubLabel(c) })),
    ];
    return {
      clubs: known,
      clubOptions,
      groups: sorted(groups),
      ages: sorted(ages),
      squads: new Map([...squads].map(([k, m]) => [k, [...m.values()]])),
    };
  }, [data]);
}

export function TeamNameFields({
  value,
  onChange,
  suggestions,
  label,
  compact = false,
  own = false,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions?: TeamNameSuggestions;
  /** Ruudunlukijan nimi, esim. "Ottelu 2: vastustaja". */
  label: string;
  /** Tiivis rivi (otteluohjelma): ei otsikoita, paikkamerkit kertovat kentät. */
  compact?: boolean;
  /** Oma joukkue: vanha nimi ilman erotinta ("P2016 Sininen") on ryhmä, ei seura. */
  own?: boolean;
}) {
  const id = useId();
  const parse = (v: string): TeamParts => {
    const p = parseTeamName(v);
    return own && !/[/·|]/.test(v) && p.club ? { club: '', group: p.club, ...(p.age ? { age: p.age } : {}) } : p;
  };
  const [parts, setParts] = useState<TeamParts>(() => parse(value));
  // Ulkoinen muutos (esim. lomakkeen nollaus) → kentät jäsennetään uudelleen.
  useEffect(() => {
    if (value !== formatTeamName(parts)) setParts(parse(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const set = (patch: Partial<TeamParts>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(formatTeamName(next));
  };
  const k = clubKey(parts.club);
  const field = (key: keyof TeamParts, text: string, placeholder: string, max: number, list?: (string | ClubOption)[], extra = '') => (
    <label className={`block min-w-0 ${extra}`}>
      {!compact && <span className="mb-1 block text-xs font-semibold text-slate-600">{text}</span>}
      <input
        className={inputClass}
        value={parts[key] ?? ''}
        onChange={(e) => set({ [key]: e.target.value })}
        maxLength={max}
        placeholder={placeholder}
        list={list?.length ? `${id}-${key}` : undefined}
        aria-label={`${label}: ${text.toLowerCase()}`}
      />
      {list && list.length > 0 && (
        <datalist id={`${id}-${key}`}>
          {list.map((o, i) =>
            typeof o === 'string' ? <option key={o} value={o} /> : <option key={`${o.value}-${i}`} value={o.value} label={o.label} />,
          )}
        </datalist>
      )}
    </label>
  );
  // Seuran tunnetut ryhmät valintasiruina. Tiiviissä rivissä vain kun ryhmää ei ole vielä annettu.
  const known = (parts.club.trim() && suggestions?.squads.get(k)) || [];
  const current = squadKey(parts);
  const chips = compact && (parts.group || parts.age) ? [] : known.slice(0, compact ? 6 : 12);
  const fields = (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
      {field('club', 'Seura', compact ? 'Seura, esim. FC Honka' : 'esim. FC Honka', 40, suggestions?.clubOptions, 'col-span-2 sm:col-span-1')}
      {field('group', 'Ryhmä', compact ? 'Ryhmä' : 'esim. Musta', 30, suggestions?.groups.get(k))}
      {/* Lyhyt otsikko: pitkä "Ikäluokka (syntymävuosi)" rivittyi ja laski kentän muita alemmas (17.11.2026). */}
      {field('age', 'Ikäluokka', compact ? 'Syntymävuosi' : 'syntymävuosi, esim. 2018', 12, suggestions?.ages.get(k))}
    </div>
  );
  if (!chips.length) return fields;
  return (
    <div>
      {fields}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={`${label}: seuran ryhmät`}>
        {!compact && <span className="text-xs text-slate-500">Ryhmät:</span>}
        {chips.map((q) => {
          const on = squadKey({ ...q, club: parts.club }) === current;
          return (
            <button
              key={squadKey(q)}
              type="button"
              aria-pressed={on}
              onClick={() => set({ group: q.group ?? '', age: q.age ?? '' })}
              className={`press min-h-8 rounded-full px-2.5 text-xs font-semibold ring-1 ${on ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-raised)] text-slate-700 ring-slate-300'}`}
            >
              {[q.group, ageLabel(q.age)].filter(Boolean).join(' · ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
