import type { Timestamp } from '../domain/types';

let lastMs = 0;
/**
 * Aidosti kasvava aikaleima tällä laitteella: kaksi muutosta samassa
 * millisekunnissa saavat eri arvot, jotta "uudempi voittaa" -yhdistäminen ja
 * järjestys luontiajan mukaan pysyvät yksiselitteisinä.
 */
export const nowTimestamp = (): Timestamp => {
  lastMs = Math.max(Date.now(), lastMs + 1);
  return new Date(lastMs).toISOString();
};
