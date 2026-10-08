const bcrypt = require('bcrypt');

function getAdminConfig() {
  const username = process.env.ADMIN_USERNAME || 'hmeeti';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';
  const adminPath = (process.env.ADMIN_PATH || 'ctl/x7k9m2p4w4oblako').replace(/^\/+|\/+$/g, '');

  if (!passwordHash) {
    console.warn('[auth] ADMIN_PASSWORD_HASH is not set. Admin login will be disabled until configured.');
  }

  return { username, passwordHash, adminPath };
}

function requireAuth(req, res, next) {
  if (req.session?.adminUser) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

async function verifyLogin(username, password) {
  const { username: expectedUser, passwordHash } = getAdminConfig();
  if (!passwordHash) return false;

  const user = String(username || '').trim();
  const pass = String(password || '').trim();
  if (!user || !pass) return false;
  if (user.toLowerCase() !== String(expectedUser).trim().toLowerCase()) return false;

  try {
    return await bcrypt.compare(pass, passwordHash.trim());
  } catch (err) {
    console.error('[auth] bcrypt error:', err.message);
    return false;
  }
}

module.exports = { getAdminConfig, requireAuth, verifyLogin };
