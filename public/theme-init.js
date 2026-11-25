// Asettaa teeman (vaalea/tumma) ja väriteeman ennen sovelluksen latautumista, jotta väärä teema ei välähdä.
// Erillinen tiedosto, koska sisältöturvakäytäntö (CSP) estää inline-skriptit.
(function () {
  // Oletukset: vaalea teema ja Vuono-väriteema (sama kuin src/ui/theme.ts).
  var choice = 'light';
  var accent = 'fjord';
  // Esimerkkitilasta poistumatta suljettu välilehti: omat näkymäasetukset takaisin ennen teeman asetusta
  // (sama kuin src/demo/demoMode.ts).
  try {
    var saved = sessionStorage.getItem('demoMode') !== '1' && localStorage.getItem('demoReturnSaved');
    if (saved) {
      var values = JSON.parse(saved);
      localStorage.clear();
      for (var k in values) localStorage.setItem(k, values[k]);
    }
  } catch (e) {}
  try {
    choice = localStorage.getItem('theme') || 'light';
    accent = localStorage.getItem('accent') || 'fjord';
  } catch (e) {}
  var dark = choice === 'dark' || (choice === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  if (dark) root.classList.add('dark');
  if (accent === 'fjord' || accent === 'heather' || accent === 'graphite') root.setAttribute('data-accent', accent);
  // Fonttivalinta (25.11.2026, sama kuin src/ui/theme.ts applyFont).
  try {
    var font = localStorage.getItem('font');
    if (font === 'sport' || font === 'modern') root.setAttribute('data-font', font);
  } catch (e) {}
  root.style.colorScheme = dark ? 'dark' : 'light';
  // Yläpalkin väri heti (sama kuin src/ui/theme.ts), ettei tumman teeman ikkunapalkki välähdä vaaleana (17.11.2026).
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta && dark) meta.setAttribute('content', '#0f1613');
  // Tausta (17.11.2026, sama kuin src/ui/theme.ts applyBackground): piirretty tai oma kuva himmennettynä.
  try {
    var bg = localStorage.getItem('background');
    var photo = localStorage.getItem('bgPhoto');
    var dim = Number(localStorage.getItem('bgDim'));
    if (bg === 'photo' && !photo) bg = null;
    if (bg === 'grass' || bg === 'fjord' || bg === 'forest' || bg === 'snow' || bg === 'paper' || bg === 'aurora' || bg === 'floodlight' || bg === 'photo') root.setAttribute('data-bg', bg);
    if (photo) root.style.setProperty('--bg-photo', 'url("' + photo + '")');
    root.style.setProperty('--bg-dim', (dim >= 20 && dim <= 95 ? dim : 65) + '%');
  } catch (e) {}
})();
