// Asettaa teeman (vaalea/tumma) ja väriteeman ennen sovelluksen latautumista, jotta väärä teema ei välähdä.
// Erillinen tiedosto, koska sisältöturvakäytäntö (CSP) estää inline-skriptit.
(function () {
  // Oletukset: vaalea teema ja Vuono-väriteema (sama kuin src/ui/theme.ts).
  var choice = 'light';
  var accent = 'fjord';
  try {
    choice = localStorage.getItem('theme') || 'light';
    accent = localStorage.getItem('accent') || 'fjord';
  } catch (e) {}
  var dark = choice === 'dark' || (choice === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  if (dark) root.classList.add('dark');
  if (accent === 'fjord' || accent === 'heather' || accent === 'graphite') root.setAttribute('data-accent', accent);
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
