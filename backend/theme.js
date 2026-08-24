document.addEventListener('DOMContentLoaded', function () {
  var root = document.documentElement;
  var toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  function getTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    toggleBtn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    toggleBtn.setAttribute(
      'aria-label',
      theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'
    );
    try {
      localStorage.setItem('horus-theme', theme);
    } catch (e) {}
  }

  // Sincroniza el botón con el tema que ya aplicó el script inline del <head>
  applyTheme(getTheme());

  toggleBtn.addEventListener('click', function () {
    applyTheme(getTheme() === 'light' ? 'dark' : 'light');
  });
});