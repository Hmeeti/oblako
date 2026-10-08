const fs = require('fs');
const path = require('path');
const convert = require('heic-convert');
const sharp = require('sharp');

const SKIP_FILES = new Set(['logo.png', 'favicon.png', '.gitkeep']);
const IMAGE_EXT = /\.(heic|heif|jpe?g|png|webp)$/i;

async function convertHeicToJpeg(inputPath) {
  const inputBuffer = fs.readFileSync(inputPath);
  const outputBuffer = await convert({ buffer: inputBuffer, format: 'JPEG', quality: 0.92 });
  return Buffer.from(outputBuffer);
}

async function optimizeImage(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  let buffer;

  if (ext === '.heic' || ext === '.heif') {
    buffer = await convertHeicToJpeg(inputPath);
  } else {
    buffer = fs.readFileSync(inputPath);
  }

  await sharp(buffer)
    .rotate()
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outputPath);

  return outputPath;
}

function listDishPhotos(imageDir) {
  if (!fs.existsSync(imageDir)) return [];
  return fs.readdirSync(imageDir)
    .filter(f => IMAGE_EXT.test(f) && !SKIP_FILES.has(f.toLowerCase()))
    .map(f => path.join(imageDir, f));
}

module.exports = { optimizeImage, listDishPhotos, SKIP_FILES };
