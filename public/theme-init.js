(function () {
  try {
    var theme = localStorage.getItem('weesize-theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (error) {
    /* Theme is optional. File bytes are never stored. */
  }
})();
