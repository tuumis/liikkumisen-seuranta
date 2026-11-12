// Jalkapallon päiväkirja: kaikki treenit, omatoimiset harjoitukset, pelit ja turnaukset yhdessä
// listassa kommentteineen. Haku, suodatus ja nopea kommentin lisäys suoraan listasta.

import { useMemo, useState } from 'react';
import { footballKindOf, LEVEL_LABEL, OUTCOME_LABEL, outcomeOf, POSITION_LABEL } from '../../domain/football';
import type { ActivityType, FootballDetails, Profile, Session } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card, inputClass } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';
import { dayLabel, formatDate } from '../../ui/format';
import { ENJOYMENT_LABEL, FOCUS_TAG_LABEL } from '../../ui/labels';
import { useToast } from '../../ui/Toast';
import { TypeIcon } from '../week/Dashboard';
import { FootballPanel } from '../football/FootballPanel';
import { useFootball } from '../football/useFootball';

type Filter = 'all' | 'training' | 'games';

export function DiaryView({ profile }: { profile: Profile }) {
  const data = useFootball(profile.id);
  const [filter, setFilter] = useState<Filter>('all');
  const [onlyCommented, setOnlyCommented] = useState(false);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<Session | null>(null);

  const entries = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLocaleLowerCase('fi');
    return data.sessions
      .filter((s) => !s.deletedAt)
      .map((s) => ({ s, t: data.types.get(s.activityTypeId), d: data.details.get(s.id), kind: footballKindOf(s, data.types) }))
      .filter(({ kind }) => (filter === 'all' ? true : filter === 'training' ? kind === 'training' : kind === 'game' || kind === 'tournament'))
      .filter(({ d, s }) => !onlyCommented || hasComment(s, d))
      .filter(({ s, t, d }) => {
        if (!q) return true;
        const hay = [t?.name, s.note, d?.ratingNote, d?.opponent, d?.team, d?.eventName, ...(d?.games ?? []).flatMap((g) => [g.opponent, g.note]), ...(d?.focusTags ?? []).map((x) => FOCUS_TAG_LABEL[x])]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('fi');
        return hay.includes(q);
      })
      .sort((a, b) => b.s.date.localeCompare(a.s.date) || b.s.createdAt.localeCompare(a.s.createdAt));
  }, [data, filter, onlyCommented, query]);

  const byMonth = new Map<string, typeof entries>();
  for (const e of entries) {
    const k = e.s.date.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
  }
  const commented = (data?.sessions ?? []).filter((s) => !s.deletedAt && hasComment(s, data?.details.get(s.id))).length;

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3">
          <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hae kommenteista, vastustajista, tageista…" aria-label="Hae päiväkirjasta" />
          <div className="flex flex-wrap gap-2">
            <ToggleChip on={filter === 'all'} onChange={() => setFilter('all')}>
              Kaikki
            </ToggleChip>
            <ToggleChip on={filter === 'training'} onChange={() => setFilter('training')}>
              Treenit
            </ToggleChip>
            <ToggleChip on={filter === 'games'} onChange={() => setFilter('games')}>
              Pelit ja turnaukset
            </ToggleChip>
            <ToggleChip on={onlyCommented} onChange={setOnlyCommented}>
              Vain kommentoidut
            </ToggleChip>
          </div>
          <p className="text-xs text-slate-500">
            {data?.sessions.filter((s) => !s.deletedAt).length ?? 0} jalkapallokertaa, joista {commented} kommentoitu. Uusi kerta kirjataan Viikko-näkymän +-painikkeella.
          </p>
        </div>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">{query || onlyCommented || filter !== 'all' ? 'Ei osumia valinnoilla.' : 'Ei vielä jalkapallokertoja.'}</p>
        </Card>
      ) : (
        [...byMonth.entries()].map(([month, list]) => (
          <section key={month}>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {formatDate(`${month}-01`, 'LLLL yyyy')} · {list.length}
            </h3>
            <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 2xl:grid-cols-3">
              {list.map((e) => (
                <DiaryEntry key={e.s.id} s={e.s} t={e.t} d={e.d} onDetails={() => setPanel(e.s)} />
              ))}
            </ul>
          </section>
        ))
      )}

      <FootballPanel session={panel} type={panel ? data?.types.get(panel.activityTypeId) : undefined} onClose={() => setPanel(null)} />
    </div>
  );
}

const hasComment = (s: Session, d?: FootballDetails) => !!(d?.ratingNote || s.note || d?.games?.some((g) => g.note));

function DiaryEntry({ s, t, d, onDetails }: { s: Session; t?: ActivityType; d?: FootballDetails; onDetails: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d?.ratingNote ?? '');
  const result = d && t?.footballKind === 'game' ? outcomeOf(d.goalsFor, d.goalsAgainst) : undefined;

  async function save() {
    await repo.setFootballNote(s.id, text);
    toast(text.trim() ? 'Kommentti tallennettu' : 'Kommentti poistettu');
    setEditing(false);
  }

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <TypeIcon t={t} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-slate-900">{dayLabel(s.date)}</span>
            <span className="text-sm text-slate-700">{t?.name ?? 'Jalkapallo'}</span>
            <span className="text-xs text-slate-500">
              {s.durationMin} min{s.playedMin !== undefined ? ` · pelattu ${s.playedMin}` : ''}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-600">
            {d?.opponent && (
              <span>
                vs {d.opponent}
                {result && ` ${d.goalsFor}–${d.goalsAgainst} ${OUTCOME_LABEL[result]}`}
              </span>
            )}
            {d?.eventName && <span>🏆 {d.eventName}</span>}
            {d?.level && <span>{LEVEL_LABEL[d.level]}</span>}
            {d?.format && <span>{d.format}</span>}
            {d?.positions?.length ? <span>{d.positions.map((p) => POSITION_LABEL[p].toLowerCase()).join(', ')}</span> : null}
            {d?.playerGoals ? <span className="font-medium text-slate-800">⚽ {d.playerGoals}</span> : null}
            {d?.attendance === 'partial' && <span>osittain</span>}
            {d?.enjoyment && <span>{['', '🙁', '🙂', '😄'][d.enjoyment]} {ENJOYMENT_LABEL[d.enjoyment].toLowerCase()}</span>}
            {d?.parentRating && <span className="text-amber-600">{'★'.repeat(d.parentRating)}</span>}
            {d?.focusTags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-1.5">
                {FOCUS_TAG_LABEL[tag]}
              </span>
            ))}
          </div>
          {d?.games && d.games.length > 0 && (
            <ol className="mt-1.5 space-y-0.5 text-xs text-slate-700">
              {d.games.map((g, i) => {
                const o = outcomeOf(g.goalsFor, g.goalsAgainst);
                return (
                  <li key={i}>
                    <span className="text-slate-500">{i + 1}.</span> {g.opponent ?? 'vastustaja ?'}
                    {o && <span className="font-medium"> {g.goalsFor}–{g.goalsAgainst} {OUTCOME_LABEL[o]}</span>}
                    {g.note && <span className="italic text-slate-600"> – {g.note}</span>}
                  </li>
                );
              })}
            </ol>
          )}

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                className={`${inputClass} min-h-24 py-2`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                autoFocus
                placeholder="Mitä treenissä tehtiin, miten meni, mitä jäi mieleen…"
                aria-label="Päiväkirjakommentti"
              />
              <div className="flex gap-2">
                <Button onClick={save}>Tallenna</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setText(d?.ratingNote ?? '');
                    setEditing(false);
                  }}
                >
                  Peruuta
                </Button>
              </div>
            </div>
          ) : (
            <>
              {d?.ratingNote && <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{d.ratingNote}</p>}
              {s.note && <p className="mt-1 text-xs italic text-slate-500">Muistiinpano: {s.note}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="min-h-9 rounded-lg px-2 text-sm font-medium text-green-800 hover:bg-green-50" onClick={() => setEditing(true)}>
                  {d?.ratingNote ? '✎ Muokkaa kommenttia' : '+ Kommentti'}
                </button>
                <button type="button" className="min-h-9 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-50" onClick={onDetails}>
                  Lisätiedot
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
