// Profiilin vaihto ilman välkettä (17.11.2026, käyttäjän havainto "valikko välkkyy, kun vaihtaa profiilia").
// Näkymän kortit hakevat tietonsa kukin omalla live-kyselyllään, joten uuden profiilin tiedot saapuvat
// porrastetusti (100–650 ms). Sisältöalue piilotetaan vaihdon hetkellä ja tuodaan näkyviin kerralla, kun
// muutokset ovat hetken rauhoittuneet, eikä välitiloja nähdä.

/** Hiljainen jakso (ms), jonka jälkeen sisältö katsotaan valmiiksi. */
const QUIET_MS = 160;
/** Enimmäisaika (ms): sisältö tulee näkyviin viimeistään tämän jälkeen. */
const MAX_MS = 900;

/**
 * Merkitsee elementin `data-switching`-tilaan (CSS piilottaa sen) ja poistaa merkinnän, kun elementin
 * sisällössä ei ole tapahtunut muutoksia QUIET_MS-aikaan tai MAX_MS on kulunut. Palauttaa siivouksen.
 */
export function hideUntilSettled(el: HTMLElement): () => void {
  el.setAttribute('data-switching', '');
  let quiet = 0;
  const done = () => {
    window.clearTimeout(quiet);
    window.clearTimeout(cap);
    mo.disconnect();
    el.removeAttribute('data-switching');
  };
  const arm = () => {
    window.clearTimeout(quiet);
    quiet = window.setTimeout(done, QUIET_MS);
  };
  const mo = new MutationObserver(arm);
  mo.observe(el, { subtree: true, childList: true, characterData: true });
  const cap = window.setTimeout(done, MAX_MS);
  arm();
  return done;
}
