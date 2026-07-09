// Apply theme immediately to prevent flash of wrong theme.
// Kept as an external file (not inline) because the blog prerendering
// pipeline strips inline <script> blocks from generated static HTML but
// preserves external <script src="..."> references.
(function () {
  var theme = localStorage.getItem('amanah-theme');
  if (theme === 'dark' || !theme) {
    document.documentElement.classList.add('dark');
  }
})();
