// Puhelimen takaisin-ele sulkee päällimmäisen paneelin (19.11.2026, käyttäjän hyväksymä parannus).
// Jokainen auki oleva paneeli tai koko ruudun näkymä lisää selaimen historiaan oman merkinnän (sama osoite).
// Takaisin-ele poistaa merkinnän, ja tämä moduuli sulkee päällimmäisen paneelin. Kun paneeli suljetaan
// muuten (✕, taustan napautus, Esc, tallennus), sen merkintä poistetaan history.back():lla, jotta historiaan
// ei jää ylimääräisiä askelia. Sisäkkäiset paneelit muodostavat pinon.
//
// Korjaus 25.11.2026 (käyttäjä: oikean reunan pyyhkäisy toi hetkeksi toisen sivun): history.back() jätti
// merkinnän historiaan eteenpäin-suuntaan, ja iPhonen eteenpäin-ele (pyyhkäisy oikeasta reunasta) avasi sen
// hetkeksi. Nyt viimeisen paneelin sulkeminen muuten kuin takaisin-eleellä muuttaa merkinnän varamerkinnäksi
// (replaceState) eikä palaa historiassa; seuraava paneeli käyttää varamerkinnän uudelleen. Eteenpäin-suuntaan
// ei jää mitään. Hinta: varamerkinnältä takaisin-ele ei näytä muutosta (Androidissa yksi tyhjä painallus).

import { useEffect, useRef } from 'react';

interface Entry {
  close: () => void;
  /** Onko merkintä jo historiassa (avaus voi odottaa kesken olevaa history.back():ia). */
  pushed: boolean;
}

const stack: Entry[] = [];
/** Omat history.back()-kutsut, joiden popstate-tapahtumat ohitetaan. */
let expectedPops = 0;
let listening = false;
const MARK = 'sheet';
const SPARE = 'spareSheet';

const isSpare = () => !!(history.state as Record<string, unknown> | null)?.[SPARE];

function pushEntry(e: Entry) {
  // Alimmainen paneeli varamerkinnän päällä: käytetään se uudelleen (ei uutta askelta historiaan).
  if (stack[0] === e && isSpare()) history.replaceState({ [MARK]: true }, '');
  else history.pushState({ [MARK]: true }, '');
  e.pushed = true;
}

/** Odottamaan jääneet avaukset historiaan, kun omat paluut ovat valmiit. */
function flush() {
  for (const e of stack) if (!e.pushed) pushEntry(e);
}

function onPop(ev: PopStateEvent) {
  if (expectedPops > 0) {
    expectedPops--;
    if (expectedPops === 0) flush();
    return;
  }
  const top = stack.pop();
  if (top) {
    top.close();
    return;
  }
  // Ei avointa paneelia, mutta vanha paneelimerkintä (esim. sivun uudelleenlatauksen jälkeen): ohi.
  if ((ev.state as Record<string, unknown> | null)?.[MARK]) {
    expectedPops++;
    history.back();
  }
}

/** Takaisin-ele sulkee näkymän, kun `active` on tosi. */
export function useBackClose(active: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    if (!listening) {
      window.addEventListener('popstate', onPop);
      listening = true;
    }
    const entry: Entry = { close: () => close.current(), pushed: false };
    stack.push(entry);
    if (expectedPops === 0) pushEntry(entry);
    return () => {
      const i = stack.indexOf(entry);
      // Suljettu takaisin-eleellä: merkintä on jo poistunut historiasta.
      if (i < 0) return;
      stack.splice(i, 1);
      if (!entry.pushed) return;
      if (stack.length === 0 && expectedPops === 0) {
        // Viimeinen paneeli: merkintä varamerkinnäksi, ei history.back():ia (ei eteenpäin-merkintää).
        history.replaceState({ [SPARE]: true }, '');
        return;
      }
      expectedPops++;
      history.back();
    };
  }, [active]);
}

/** Testejä varten: pinon koko. */
export const openBackEntries = () => stack.length;
