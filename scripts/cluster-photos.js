const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function fingerprint(file) {
  const img = sharp(file).resize(16, 16, { fit: 'fill' }).removeAlpha();
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });
  // simple average hash style signature
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const avg = sum / data.length;
  let bits = '';
  for (let i = 0; i < data.length; i++) bits += data[i] > avg ? '1' : '0';
  return bits;
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

(async () => {
  const dir = path.join(process.cwd(), 'image', 'optimized');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).sort();
  const fps = [];
  for (const f of files) {
    const fp = await fingerprint(path.join(dir, f));
    fps.push({ f, fp });
  }

  const clusters = [];
  const used = new Set();
  for (const item of fps) {
    if (used.has(item.f)) continue;
    const cluster = [item.f];
    used.add(item.f);
    for (const other of fps) {
      if (used.has(other.f)) continue;
      if (hamming(item.fp, other.fp) <= 40) {
        cluster.push(other.f);
        used.add(other.f);
      }
    }
    clusters.push(cluster);
  }

  clusters.sort((a, b) => b.length - a.length);
  console.log(`Unique clusters: ${clusters.length} from ${files.length} photos\n`);
  clusters.forEach((c, i) => {
    console.log(`#${i + 1} (${c.length}x) representative: ${c[0]}`);
    if (c.length > 1) console.log(`   also: ${c.slice(1, 6).join(', ')}${c.length > 6 ? '...' : ''}`);
  });

  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'photo-clusters.json'),
    JSON.stringify(clusters.map(c => ({ representative: c[0], files: c })), null, 2)
  );
})();
