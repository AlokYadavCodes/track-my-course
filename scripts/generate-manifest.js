// Script to generate browser-specific manifest.json files and copy assets (icons, src)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const baseManifest = require(path.join(root, 'manifest.json'));

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  try {
    // fs.cpSync is available in Node 16.7+. Use it when possible for simplicity.
    if (fs.cpSync) {
      fs.cpSync(src, dest, { recursive: true });
      return true;
    }
  } catch (e) {
    // fallthrough to manual copy
  }

  // Fallback manual copy
  if (!fs.existsSync(src)) return false;
  safeMkdir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const real = fs.readlinkSync(srcPath);
      try { fs.symlinkSync(real, destPath); } catch (e) { fs.copyFileSync(srcPath, destPath); }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  return true;
}

function listFilesCount(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) count += listFilesCount(p);
    else count += 1;
  }
  return count;
}

function generateManifestFor(browser) {
  const manifest = { ...baseManifest };
  if (browser === 'chrome') {
    manifest.manifest_version = 3;
    // chrome-specific tweaks can go here
  } else if (browser === 'firefox') {
    // Many Firefox add-ons still accept manifest v2; we intentionally downgrade
    // to v2 for compatibility if needed. Adjust as required.
    manifest.manifest_version = 2;
    manifest.browser_specific_settings = manifest.browser_specific_settings || {};
    manifest.browser_specific_settings.gecko = manifest.browser_specific_settings.gecko || {
      id: '',
      strict_min_version: '57.0'
    };
  }

  const outDir = path.join(root, 'dist', browser);
  safeMkdir(outDir);
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Copy icons and src
  const iconsSrc = path.join(root, 'icons');
  const srcSrc = path.join(root, 'src');
  let copiedIcons = false;
  let copiedSrc = false;
  try {
    if (fs.existsSync(iconsSrc)) {
      copiedIcons = copyRecursive(iconsSrc, path.join(outDir, 'icons'));
    }
    if (fs.existsSync(srcSrc)) {
      copiedSrc = copyRecursive(srcSrc, path.join(outDir, 'src'));
    }
  } catch (err) {
    console.error('Error copying assets:', err);
  }

  console.log(`${browser} bundle generated at ${outDir}`);
}

const target = process.argv[2];
if (target === 'chrome') generateManifestFor('chrome');
else if (target === 'firefox') generateManifestFor('firefox');
else {
  generateManifestFor('chrome');
  generateManifestFor('firefox');
}
