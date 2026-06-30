// theme.js — applies the saved appearance preference immediately.
// Loaded synchronously in <head> (before body renders) on every page
// except room.html, which always stays in the dark "Studio" theme.
(function () {
  var theme = localStorage.getItem('lc_theme') || 'dark';
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
