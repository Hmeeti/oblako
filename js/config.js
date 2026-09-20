/**
 * Frontend config for hybrid hosting:
 * - GitHub Pages = guest menu (static)
 * - Render = API + admin panel
 *
 * After Render deploy, set both URLs (no trailing slash), e.g.
 *   "https://oblako-xxxx.onrender.com"
 *
 * Leave empty ("") for local same-origin / npm start.
 */
window.OBLAKO_CONFIG = {
  // TODO: replace after Render deploy
  apiBase: '',
  // Admin opens from the Pages footer link
  adminUrl: '',
};
