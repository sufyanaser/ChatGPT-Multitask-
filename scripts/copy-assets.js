const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      // Copy html, css, svg, json, png assets
      const ext = path.extname(entry.name).toLowerCase();
      if (['.html', '.css', '.svg', '.json', '.png', '.jpg', '.ico'].includes(ext)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

const rendererSrc = path.join(__dirname, '..', 'src', 'renderer');
const rendererDest = path.join(__dirname, '..', 'dist', 'renderer');

if (fs.existsSync(rendererSrc)) {
  copyDir(rendererSrc, rendererDest);
  console.log('Static assets copied to dist/renderer');
}
