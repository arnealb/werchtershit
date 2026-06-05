/**
 * Generates PWA app icons from an inline SVG design.
 * Usage: npx tsx scripts/generate-icons.ts
 */
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const OUT_DIR = path.join(process.cwd(), 'public', 'icons');

function iconSvg(maskable: boolean): string {
  // Maskable icons need ~20% safe zone padding around the artwork
  const scale = maskable ? 0.72 : 0.88;
  const size = 512;
  const artSize = size * scale;
  const offset = (size - artSize) / 2;

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1b0f0c"/>
      <stop offset="100%" stop-color="#0a0908"/>
    </linearGradient>
    <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#c1271a"/>
      <stop offset="100%" stop-color="#ff3b2f"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : 96}" fill="url(#bg)"/>
  <g transform="translate(${offset}, ${offset}) scale(${scale})">
    <!-- stylized W as three festival-stage beams -->
    <g fill="url(#flame)">
      <polygon points="96,128 160,128 208,384 144,384"/>
      <polygon points="224,128 288,128 256,384 192,384"/>
      <polygon points="352,128 416,128 368,384 304,384"/>
      <polygon points="240,200 272,200 304,384 240,384"/>
    </g>
    <!-- year tag -->
    <rect x="180" y="408" width="152" height="56" rx="14" fill="#f3ede2"/>
    <text x="256" y="450" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="42" font-weight="900" fill="#0a0908">2026</text>
  </g>
</svg>`;
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const standard = Buffer.from(iconSvg(false));
  const maskable = Buffer.from(iconSvg(true));

  const outputs: { source: Buffer; size: number; name: string }[] = [
    { source: standard, size: 192, name: 'icon-192.png' },
    { source: standard, size: 512, name: 'icon-512.png' },
    { source: maskable, size: 512, name: 'icon-512-maskable.png' },
    { source: standard, size: 180, name: 'apple-touch-icon.png' },
  ];

  for (const { source, size, name } of outputs) {
    await sharp(source).resize(size, size).png().toFile(path.join(OUT_DIR, name));
    console.log(`generated ${name}`);
  }
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
