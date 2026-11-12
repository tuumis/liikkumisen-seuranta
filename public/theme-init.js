// Asettaa teeman (vaalea/tumma) ja väriteeman ennen sovelluksen latautumista, jotta väärä teema ei välähdä.
// Erillinen tiedosto, koska sisältöturvakäytäntö (CSP) estää inline-skriptit.
(function () {
  var choice = 'system';
  var accent = '';
  try {
    choice = localStorage.getItem('theme') || 'system';
    accent = localStorage.getItem('accent') || '';
  } catch (e) {}
  var dark = choice === 'dark' || (choice !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  if (dark) root.classList.add('dark');
  if (accent === 'fjord' || accent === 'heather' || accent === 'graphite') root.setAttribute('data-accent', accent);
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
