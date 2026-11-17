// Päivän tavoite (reipas + rasittava, min) päiväpylväisiin ja tavoitteen täyttymiseen (SPEC 16).

import { earlyYearsDay } from './aggregate';
import { RECOMMENDATIONS } from './recommendations';
import type { DayTotals, IntensityMinutes, RecommendationGroup } from './types';

export const DAY_TARGET: Record<RecommendationGroup, number> = {
  early_years: RECOMMENDATIONS.early_years.mvpaMinPerDay.value,
  school_age: RECOMMENDATIONS.school_age.mvpaAvgMinPerDay.value,
  adult: RECOMMENDATIONS.adult.weightedMinPerWeek.value / 7,
};

/**
 * Päivätavoitteeseen verrattava luku (17.11.2026): aikuisella reipas + 2 × rasittava kuten viikon
 * 150 min -suosituksessa (DAY_TARGET.adult on siitä seitsemäsosa), muilla reipas + rasittava.
 */
export function dayGoalValue(group: RecommendationGroup, m: IntensityMinutes): number {
  return group === 'adult' ? m.moderate + RECOMMENDATIONS.adult.vigorousWeight.value * m.vigorous : m.moderate + m.vigorous;
}

/**
 * Täyttyikö päivän tavoite (kirjattu + arkiliikunta). Alle kouluikäisellä molemmat ehdot:
 * liikuttu kesto ≥ 180 min ja vauhdikas ≥ 60 min; aikuisella painotettu (dayGoalValue), muilla reipas + rasittava.
 */
export function dayGoalMet(group: RecommendationGroup, d: DayTotals): boolean {
  if (group === 'early_years') return earlyYearsDay(d).met;
  return dayGoalValue(group, d.combined) >= DAY_TARGET[group] - 1e-9;
}
