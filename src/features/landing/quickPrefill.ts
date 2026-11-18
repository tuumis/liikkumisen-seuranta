// Pikatestin vastaukset ohjelman aloitukseen (18.11.2026). Vain muistissa: ei tallenneta mihinkään,
// joten ne katoavat sivun latauksessa. Aloitus tyhjentää ne lopuksi.

import type { QuickPrefill } from '../../domain/quickCheck';

let pending: QuickPrefill | undefined;

export function setQuickPrefill(p: QuickPrefill | undefined): void {
  pending = p;
}

export function getQuickPrefill(): QuickPrefill | undefined {
  return pending;
}
