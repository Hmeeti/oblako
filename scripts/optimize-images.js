/**
 * Batch-optimize dish photos → WebP 400 / 800 (q≈75).
 * Originals copied to image/originals/dishes/ (gitignored).
 *
 * Usage: node scripts/optimize-images.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'image', 'dishes');
const ORIG = path.join(ROOT, 'image', 'originals', 'dishes');
const OUT400 = path.join(SRC, 'w400');
const OUT800 = path.join(SRC, 'w800');

async function ensureDirs() {
  for (const d of [ORIG, OUT400, OUT800]) fs.mkdirSync(d, { recursive: true });
}

async function optimizeLogo() {
  const logo = path.join(ROOT, 'image', 'logo.png');
  if (!fs.existsSync(logo)) return;
  const out = path.join(ROOT, 'image', 'logo.webp');
  await sharp(logo)
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(out);
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`logo.webp ${kb} KB`);

  const touch = path.join(ROOT, 'image', 'apple-touch-icon.png');
  await sharp(logo).resize(180, 180, { fit: 'contain', background: '#0d0d0d' }).png().toFile(touch);
  console.log('apple-touch-icon.png');
}

async function run() {
  await ensureDirs();
  await optimizeLogo();

  const files = fs.readdirSync(SRC).filter(f => /\.jpe?g$/i.test(f) && !f.startsWith('.'));
  let before = 0;
  let after = 0;

  for (const file of files) {
    const id = path.parse(file).name;
    const srcPath = path.join(SRC, file);
    const buf = fs.readFileSync(srcPath);
    before += buf.length;

    const origPath = path.join(ORIG, file);
    if (!fs.existsSync(origPath)) fs.copyFileSync(srcPath, origPath);

    const w400 = await sharp(buf)
      .rotate()
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .webp({ quality: 75 })
      .toBuffer();
    const w800 = await sharp(buf)
      .rotate()
      .resize(800, 800, { fit: 'cover', position: 'centre' })
      .webp({ quality: 75 })
      .toBuffer();

    fs.writeFileSync(path.join(OUT400, `${id}.webp`), w400);
    fs.writeFileSync(path.join(OUT800, `${id}.webp`), w800);
    after += w400.length + w800.length;
    process.stdout.write('.');
  }

  console.log(`\n${files.length} dishes → w400+w800 WebP`);
  console.log(`jpg source ${(before / 1e6).toFixed(2)} MB → webp set ${(after / 1e6).toFixed(2)} MB`);
  console.log(`originals backed up in image/originals/dishes/`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
