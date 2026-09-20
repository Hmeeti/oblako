require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { execSync } = require('child_process');

const envExample = path.join(process.cwd(), '.env.example');
const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(envExample, envPath);
  console.log('Created .env from .env.example');
}

async function ensurePasswordHash() {
  const env = fs.readFileSync(envPath, 'utf8');
  if (/ADMIN_PASSWORD_HASH=.+/.test(env) && !/ADMIN_PASSWORD_HASH=\s*$/.test(env)) {
    return;
  }

  // Keep in sync with START.bat default credentials
  const tempPass = '2289073';
  const hash = await bcrypt.hash(tempPass, 12);
  const updated = env.includes('ADMIN_PASSWORD_HASH=')
    ? env.replace(/ADMIN_PASSWORD_HASH=.*/, `ADMIN_PASSWORD_HASH=${hash}`)
    : env + `\nADMIN_PASSWORD_HASH=${hash}\n`;

  fs.writeFileSync(envPath, updated);
  console.log('\n=== Admin password ===');
  console.log(`Username: hmeeti`);
  console.log(`Password: ${tempPass}`);
  console.log('========================================================\n');
}

async function main() {
  await ensurePasswordHash();
  execSync('node scripts/seed-menu.js', { stdio: 'inherit' });
  console.log('\nSetup complete. Next steps:');
  console.log('  npm start          — run the site');
  console.log('  npm run match-images — assign photos from /image folder');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
