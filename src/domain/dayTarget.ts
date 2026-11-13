// Päivän tavoite (reipas + rasittava, min) päiväpylväisiin ja tavoitteen täyttymiseen (SPEC 16).

import { RECOMMENDATIONS } from './recommendations';
import type { RecommendationGroup } from './types';

export const DAY_TARGET: Record<RecommendationGroup, number> = {
  early_years: RECOMMENDATIONS.early_years.mvpaMinPerDay.value,
  school_age: RECOMMENDATIONS.school_age.mvpaAvgMinPerDay.value,
  adult: RECOMMENDATIONS.adult.weightedMinPerWeek.value / 7,
};
