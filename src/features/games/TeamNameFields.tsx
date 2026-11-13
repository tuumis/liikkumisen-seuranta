// Joukkueen nimi kolmena kenttänä (SPEC 16): seura, ryhmä ja ikäluokka. Arvo on yksi teksti
// ("FC Honka · Musta · 2018"), joten kentät sopivat sekä vastustajalle että omalle joukkueelle.
// Ehdotukset tulevat aiemmista peleistä, omista joukkueista ja seurakirjastosta.

import { useEffect, useId, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { clubKey, formatTeamName, parseTeamName, type TeamParts } from '../../domain/opponent';
import type { UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { inputClass } from '../../ui/components';

export interface TeamNameSuggestions {
  clubs: string[];
  /** Seuran avain → ryhmät ja ikäluokat. */
  groups: Map<string, string[]>;
  ages: Map<string, string[]>;
}

export function useTeamNameSuggestions(profileId: UUID | undefined): TeamNameSuggestions | undefined {
  const data = useLiveQuery(async () => {
    if (!profileId) return undefined;
    const [names, clubs, teams] = await Promise.all([repo.footballNameSuggestions(profileId), repo.listClubs(), repo.listTeams(profileId, { includeArchived: true })]);
    return { names: [...names.opponents, ...names.teams, ...teams.map((t) => t.name)], clubs: clubs.map((c) => c.name) };
  }, [profileId]);
  return useMemo(() => {
    if (!data) return undefined;
    const clubs = new Map<string, string>();
    const groups = new Map<string, Set<string>>();
    const ages = new Map<string, Set<string>>();
    const add = (m: Map<string, Set<string>>, k: string, v?: string) => v && (m.get(k) ?? m.set(k, new Set()).get(k)!).add(v);
    for (const c of data.clubs) clubs.set(clubKey(c), c);
    for (const n of data.names) {
      const p = parseTeamName(n);
      if (!p.club) continue;
      const k = clubKey(p.club);
      if (!clubs.has(k)) clubs.set(k, p.club);
      add(groups, k, p.group);
      add(ages, k, p.age);
    }
    const sorted = (m: Map<string, Set<string>>) => new Map([...m].map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, 'fi'))]));
    return { clubs: [...clubs.values()].sort((a, b) => a.localeCompare(b, 'fi')), groups: sorted(groups), ages: sorted(ages) };
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
  const field = (key: keyof TeamParts, text: string, placeholder: string, max: number, list?: string[], extra = '') => (
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
          {list.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </label>
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
      {field('club', 'Seura', compact ? 'Seura, esim. FC Honka' : 'esim. FC Honka', 40, suggestions?.clubs, 'col-span-2 sm:col-span-1')}
      {field('group', 'Ryhmä', compact ? 'Ryhmä' : 'esim. Musta', 30, suggestions?.groups.get(k))}
      {field('age', 'Ikäluokka (syntymävuosi)', compact ? 'Syntymävuosi' : 'esim. 2018', 12, suggestions?.ages.get(k))}
    </div>
  );
}
