// Asettaa teeman ennen sovelluksen latautumista, jotta tumma tila ei välähdä vaaleana.
// Erillinen tiedosto, koska sisältöturvakäytäntö (CSP) estää inline-skriptit.
(function () {
  var choice = 'system';
  try {
    choice = localStorage.getItem('theme') || 'system';
  } catch (e) {}
  var dark = choice === 'dark' || (choice !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  if (dark) root.classList.add('dark');
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
