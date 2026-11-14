// Päivän tavoite (reipas + rasittava, min) päiväpylväisiin ja tavoitteen täyttymiseen (SPEC 16).

import { earlyYearsDay } from './aggregate';
import { RECOMMENDATIONS } from './recommendations';
import type { DayTotals, RecommendationGroup } from './types';

export const DAY_TARGET: Record<RecommendationGroup, number> = {
  early_years: RECOMMENDATIONS.early_years.mvpaMinPerDay.value,
  school_age: RECOMMENDATIONS.school_age.mvpaAvgMinPerDay.value,
  adult: RECOMMENDATIONS.adult.weightedMinPerWeek.value / 7,
};

/**
 * Täyttyikö päivän tavoite (kirjattu + arkiliikunta). Alle kouluikäisellä molemmat ehdot:
 * liikuttu kesto ≥ 180 min ja vauhdikas ≥ 60 min; muilla reipas + rasittava ≥ päivätavoite.
 */
export function dayGoalMet(group: RecommendationGroup, d: DayTotals): boolean {
  if (group === 'early_years') return earlyYearsDay(d).met;
  return d.mvpaCombined >= DAY_TARGET[group] - 1e-9;
}
