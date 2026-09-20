/**
 * Frontend config for hybrid hosting:
 * - GitHub Pages = guest menu (static)
 * - Railway/Render = API + admin panel
 *
 * After Railway deploy, set apiBase to your public Railway URL
 * (no trailing slash), e.g. "https://oblako-production.up.railway.app"
 *
 * Leave apiBase empty ("") for local same-origin / npm start.
 */
window.OBLAKO_CONFIG = {
  // TODO: replace after Railway deploy
  apiBase: '',
  // Full admin URL on Railway (opens from the Pages footer link)
  adminUrl: '',
};
