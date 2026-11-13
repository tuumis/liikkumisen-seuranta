// Tavoitteen täyttymisen ääni (SPEC 16): kun oma kirjaus tai kuittaus nostaa kuluvan viikon
// tavoitepäivien määrää tai viikon suositus täyttyy. Synkronoinnin tuomat muutokset eivät soi.

import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DAY_TARGET } from '../../domain/dayTarget';
import { weekPeriod } from '../../domain/dates';
import { DEFAULT_SETTINGS } from '../../domain/recommendations';
import type { Profile } from '../../domain/types';
import { msSinceLocalChange } from '../../db/localChange';
import { repo } from '../../db/repositories';
import { playSound } from '../../ui/sound';
import { today as todayFn } from '../../ui/today';
import { useReport } from '../analysis/useReport';
import { weekModel } from './WeekSummary';

/** Oma toiminta näin hiljattain (ms) lasketaan tavoitteen täyttäjäksi. */
const RECENT_MS = 8000;

export function GoalSound({ profile }: { profile: Profile }) {
  const today = todayFn();
  const period = weekPeriod(today);
  const report = useReport(profile, period);
  const settings = useLiveQuery(() => repo.getSettings(), []) ?? DEFAULT_SETTINGS;
  const prev = useRef<{ key: string; days: number; week: boolean } | null>(null);

  const target = report ? DAY_TARGET[report.group.group] : 0;
  const days = report ? report.allDays.filter((d) => d.date <= today && d.mvpaCombined >= target).length : -1;
  const week = !!report && report.evaluation.evaluable && weekModel(report, settings).main?.m.status === 'met';
  const key = `${profile.id}|${period.start}`;

  useEffect(() => {
    if (days < 0) return;
    const p = prev.current;
    prev.current = { key, days, week };
    if (!p || p.key !== key) return;
    if ((days > p.days || (week && !p.week)) && msSinceLocalChange() < RECENT_MS) playSound('goal', 0.35);
  }, [key, days, week]);

  return null;
}
