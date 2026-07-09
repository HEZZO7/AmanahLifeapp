// Apply theme immediately to prevent flash of wrong theme.
// Kept as an external file (not inline) because the blog prerendering
// pipeline strips inline <script> blocks from generated static HTML but
// preserves external <script src="..."> references.
(function () {
  // ?theme= takes priority so pages opened from the native app in an
  // external browser tab paint in the correct theme immediately, since
  // that tab has no access to the app's localStorage.
  var urlTheme = new URLSearchParams(window.location.search).get('theme');
  var theme = (urlTheme === 'light' || urlTheme === 'dark') ? urlTheme : localStorage.getItem('amanah-theme');
  if (theme === 'dark' || !theme) {
    document.documentElement.classList.add('dark');
  }
})();
