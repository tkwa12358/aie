const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const iconsDir = path.join(__dirname, '../frontend/public/icons');
const publicDir = path.join(__dirname, '../frontend/public');

// 确保目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG 模板 - AI English Studio 图标
const svgTemplate = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="90" fill="url(#bg)"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="200" fill="white" text-anchor="middle" font-weight="bold">AI</text>
  <path d="M128 380 L256 420 L384 380" stroke="white" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

// Maskable 版本 (有更大的安全区域)
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#3b82f6"/>
  <text x="256" y="300" font-family="Arial, sans-serif" font-size="160" fill="white" text-anchor="middle" font-weight="bold">AI</text>
  <path d="M160 350 L256 380 L352 350" stroke="white" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('开始生成 PWA 图标...\n');

  // 生成各尺寸图标
  for (const size of sizes) {
    const filename = `icon-${size}x${size}.png`;
    const filepath = path.join(iconsDir, filename);

    await sharp(Buffer.from(svgTemplate))
      .resize(size, size)
      .png()
      .toFile(filepath);

    console.log(`✓ 生成 ${filename}`);
  }

  // Apple Touch Icon (180x180)
  await sharp(Buffer.from(svgTemplate))
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('✓ 生成 apple-touch-icon.png');

  // Maskable Icon (512x512)
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'maskable-icon.png'));
  console.log('✓ 生成 maskable-icon.png');

  // Favicon (32x32)
  await sharp(Buffer.from(svgTemplate))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✓ 生成 favicon.ico');

  console.log('\n图标生成完成!');
}

generateIcons().catch(console.error);
