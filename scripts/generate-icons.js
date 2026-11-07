const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const sourceIcon = path.join(projectRoot, 'Glossy Blue-Purple ChatGPT Icon.png');
const buildDir = path.join(projectRoot, 'build');
const iconsetDir = path.join(buildDir, 'icon.iconset');
const icnsOutput = path.join(buildDir, 'icon.icns');
const pngOutput = path.join(buildDir, 'icon.png');

console.log('=== GATE E: Generating macOS Iconset & ICNS ===');

if (!fs.existsSync(sourceIcon)) {
  console.error(`FATAL: Approved icon file not found at: ${sourceIcon}`);
  process.exit(1);
}

// Ensure build directories exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}
if (fs.existsSync(iconsetDir)) {
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}
fs.mkdirSync(iconsetDir, { recursive: true });

// First create a master 1024x1024 square image using sips
const master1024 = path.join(iconsetDir, 'icon_512x512@2x.png');
console.log('1. Resampling approved icon to 1024x1024 master...');
execSync(`sips -z 1024 1024 "${sourceIcon}" --out "${master1024}"`, { stdio: 'inherit' });

// Also copy to build/icon.png as the canonical app icon
fs.copyFileSync(master1024, pngOutput);
console.log(`Saved canonical PNG icon to: ${pngOutput}`);

// Standard Apple iconset resolutions:
const iconSizes = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 }
  // icon_512x512@2x.png is already 1024x1024
];

console.log('2. Generating iconset sizes...');
for (const item of iconSizes) {
  const destPath = path.join(iconsetDir, item.name);
  execSync(`sips -z ${item.size} ${item.size} "${master1024}" --out "${destPath}"`, { stdio: 'pipe' });
  console.log(`   - ${item.name} (${item.size}x${item.size}) generated`);
}

console.log('3. Converting iconset to Apple ICNS format via iconutil...');
execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsOutput}"`, { stdio: 'inherit' });

if (fs.existsSync(icnsOutput)) {
  const stats = fs.statSync(icnsOutput);
  console.log(`✔ SUCCESS: ${icnsOutput} created (${stats.size} bytes)`);
} else {
  console.error('❌ Failed to generate .icns file');
  process.exit(1);
}
