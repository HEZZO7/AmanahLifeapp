// Apply theme immediately to prevent flash of wrong theme.
// Kept as an external file (not inline) because the blog prerendering
// pipeline strips inline <script> blocks from generated static HTML but
// preserves external <script src="..."> references.
(function () {
  // ?theme= takes priority so pages opened from the native app in an
  // external browser tab paint in the correct theme immediately, since
  // that tab has no access to the app's localStorage.
  var urlTheme = new URLSearchParams(window.location.search).get('theme');
  // Falls back to 'al_theme' too — landing.html's own theme toggle used to
  // write only that key, so users who set their preference there before
  // the two were synced still get it honored here.
  var theme = (urlTheme === 'light' || urlTheme === 'dark')
    ? urlTheme
    : (localStorage.getItem('amanah-theme') || localStorage.getItem('al_theme'));
  if (theme === 'dark' || !theme) {
    document.documentElement.classList.add('dark');
  }
})();
