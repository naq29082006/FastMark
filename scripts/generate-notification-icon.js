const path = require("path");
const fs = require("fs");

// sharp lives under backend dependencies in this monorepo.
const sharp = require(path.join(__dirname, "..", "backend", "node_modules", "sharp"));

const SIZE = 96;

// Android small icons use alpha only; system tints opaque pixels with #076F32.
// White "F" on transparent → green F in the shade / status bar.
const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <text
    x="50%"
    y="54%"
    text-anchor="middle"
    dominant-baseline="middle"
    fill="#ffffff"
    font-family="Arial Black, Arial, Helvetica, sans-serif"
    font-weight="900"
    font-size="72"
  >F</text>
</svg>`;

async function writePng(bufferOrSvg, dest, size) {
  await sharp(bufferOrSvg)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(dest);
}

async function main() {
  const root = path.join(__dirname, "..");
  const out = path.join(root, "assets", "notification-icon.png");
  const svgBuffer = Buffer.from(SVG);

  await writePng(svgBuffer, out, SIZE);
  console.log(`Wrote ${out}`);

  const densities = [
    ["drawable-mdpi", 24],
    ["drawable-hdpi", 36],
    ["drawable-xhdpi", 48],
    ["drawable-xxhdpi", 72],
    ["drawable-xxxhdpi", 96],
  ];

  for (const [folder, size] of densities) {
    const destDir = path.join(root, "android", "app", "src", "main", "res", folder);
    if (!fs.existsSync(destDir)) {
      continue;
    }
    const dest = path.join(destDir, "notification_icon.png");
    await writePng(svgBuffer, dest, size);
    console.log(`Updated ${dest}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
