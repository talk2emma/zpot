#!/usr/bin/env node
/* Generates launcher icons from the official logo mark (src/assets/branding/zpot-icon-512.png). */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src/assets/branding/zpot-icon-512.png');

async function square(size, out, { round = false, pad = 0.1 } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(src).trim().resize(inner, inner, { fit: 'contain', background: '#ffffff' }).toBuffer();
  let img = sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: logo, gravity: 'center' }]);
  if (round) {
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
    img = sharp(await img.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]);
    await img.png().toFile(out);
  } else {
    await img.flatten({ background: '#ffffff' }).removeAlpha().png().toFile(out);
  }
}

(async () => {
  const android = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, s] of Object.entries(android)) {
    const dir = path.join(root, `android/app/src/main/res/mipmap-${d}`);
    fs.mkdirSync(dir, { recursive: true });
    await square(s, path.join(dir, 'ic_launcher.png'));
    await square(s, path.join(dir, 'ic_launcher_round.png'), { round: true, pad: 0.16 });
  }
  const setDir = path.join(root, 'ios/Zpot/Images.xcassets/AppIcon.appiconset');
  const contents = JSON.parse(fs.readFileSync(path.join(setDir, 'Contents.json'), 'utf8'));
  for (const img of contents.images) {
    const [w] = img.size.split('x').map(Number);
    const scale = Number(img.scale.replace('x', ''));
    const px = Math.round(w * scale);
    const name = `icon-${img.idiom}-${img.size}@${img.scale}.png`;
    await square(px, path.join(setDir, name));
    img.filename = name;
  }
  fs.writeFileSync(path.join(setDir, 'Contents.json'), JSON.stringify(contents, null, 2));
  console.log('icons generated');
})().catch(e => { console.error(e); process.exit(1); });
