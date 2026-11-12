// Ohje kotinäytölle asentamiseen (SPEC 10: iPhonessa selaimen tallennus voi tyhjentyä ilman asennusta).

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallHint() {
  if (isStandalone()) return <p className="mt-3 text-xs text-green-800">Sovellus on asennettu kotinäytölle.</p>;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <div className="mt-3 card-sunk p-3 text-xs text-slate-700">
      <strong>Asenna kotinäytölle.</strong>{' '}
      {ios
        ? 'Safarissa: Jaa-painike → "Lisää Koti-valikkoon". Ilman asennusta selain voi tyhjentää tallennetut tiedot, joten tee myös varmuuskopio.'
        : 'Selaimen valikosta: "Asenna sovellus" tai "Lisää aloitusnäyttöön". Asennettuna sovellus toimii myös ilman verkkoa.'}
    </div>
  );
}
