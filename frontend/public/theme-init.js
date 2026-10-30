// Setzt Theme (dark/light) und Zoom vor dem ersten Rendern, damit kein
// Aufblitzen des falschen Themes entsteht. Bewusst als externe, synchron
// geladene Datei statt Inline-Script: die Content-Security-Policy erlaubt
// nur script-src 'self' (siehe frontend/security-headers.inc).
(function () {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
  var z = localStorage.getItem('zoom');
  if (z && ['85', '100', '110', '120', '130'].indexOf(z) !== -1) {
    document.documentElement.style.fontSize = z + '%';
  }
})();
