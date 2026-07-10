#!/usr/bin/env node
/**
 * Cross-platform build script for Electron + Next.js standalone.
 * Replaces `cp -r` commands that don't work on Windows in GitHub Actions.
 *
 * This script:
 * 1. Runs `next build` with standalone output
 * 2. Copies `.next/static` into `.next/standalone/.next/static`
 * 3. Copies `public/` into `.next/standalone/public/`
 * 4. Ensures Prisma engine files are available in standalone's node_modules
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  const srcStat = fs.statSync(src);
  if (!srcStat.isDirectory()) {
    // Copy single file
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return;
  }

  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip .git directories and symlinks (handle symlinks by following)
    if (entry.name === '.git') continue;

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      // Resolve symlinks and copy the actual file/directory
      try {
        const realPath = fs.realpathSync(srcPath);
        const realStat = fs.statSync(realPath);
        if (realStat.isDirectory()) {
          copyDirSync(realPath, destPath);
        } else {
          fs.copyFileSync(realPath, destPath);
        }
      } catch (err) {
        console.warn(`Warning: Could not resolve symlink ${srcPath}: ${err.message}`);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function ensurePrismaInStandalone(standaloneDir, projectRoot) {
  // Copy the generated Prisma client (includes native query engine binaries)
  const prismaDirs = [
    { from: 'node_modules/.prisma', to: 'node_modules/.prisma' },
  ];

  // Copy the entire @prisma scope to catch all sub-packages
  // (@prisma/client, @prisma/engines, @prisma/engines-version, etc.)
  const prismaScopeSrc = path.join(projectRoot, 'node_modules', '@prisma');
  if (fs.existsSync(prismaScopeSrc)) {
    const scopeEntries = fs.readdirSync(prismaScopeSrc, { withFileTypes: true });
    for (const entry of scopeEntries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        prismaDirs.push({
          from: path.join('node_modules', '@prisma', entry.name),
          to: path.join('node_modules', '@prisma', entry.name),
        });
      }
    }
  }

  for (const { from, to } of prismaDirs) {
    const srcPath = path.join(projectRoot, from);
    const destPath = path.join(standaloneDir, to);

    if (fs.existsSync(srcPath)) {
      console.log(`  Copying Prisma: ${from} -> standalone/${to}`);
      copyDirSync(srcPath, destPath);
    } else {
      console.warn(`  Warning: ${from} not found at ${srcPath}`);
    }
  }

  // Also check if standalone already has a @prisma/client and ensure it's complete
  // The standalone trace may include @prisma/client but miss the engine binaries
  const standalonePrismaClient = path.join(standaloneDir, 'node_modules/@prisma/client');
  const standalonePrismaEngine = path.join(standaloneDir, 'node_modules/.prisma');

  if (fs.existsSync(standalonePrismaEngine)) {
    // Ensure the .prisma/client index.js references the correct engine path
    const engineFiles = fs.readdirSync(standalonePrismaEngine);
    console.log(`  .prisma engine files in standalone: ${engineFiles.join(', ')}`);

    // Copy the generated Prisma client runtime if it exists
    const prismaClientIndex = path.join(standalonePrismaEngine, 'client', 'index.js');
    if (fs.existsSync(prismaClientIndex)) {
      console.log(`  Prisma client runtime found at ${prismaClientIndex}`);
    }
  }
}

// Main
const projectRoot = path.resolve(__dirname, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');

console.log('=== Building Next.js standalone for Electron ===');
console.log(`Project root: ${projectRoot}`);
console.log(`Standalone dir: ${standaloneDir}`);
console.log('');

// Step 1: Run next build
console.log('[1/4] Running next build...');
try {
  execSync('npx next build', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
} catch (err) {
  console.error('next build failed!');
  process.exit(1);
}
console.log('');

// Verify standalone was created
if (!fs.existsSync(standaloneDir)) {
  console.error('ERROR: .next/standalone was not created. Check next.config.ts has output: "standalone"');
  process.exit(1);
}
console.log('[2/4] Next.js build complete, standalone directory created.');
console.log('');

// Step 2: Copy .next/static into .next/standalone/.next/static
console.log('[3/4] Copying static assets...');
const staticSrc = path.join(projectRoot, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  copyDirSync(staticSrc, staticDest);
  console.log('  Copied .next/static -> .next/standalone/.next/static');
} else {
  console.warn('  Warning: .next/static not found');
}

// Step 3: Copy public/ into .next/standalone/public/
const publicSrc = path.join(projectRoot, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) {
  copyDirSync(publicSrc, publicDest);
  console.log('  Copied public/ -> .next/standalone/public/');
} else {
  console.warn('  Warning: public/ not found');
}
console.log('');

// Step 4: Ensure Prisma engine files are in standalone
console.log('[4/4] Ensuring Prisma engine files in standalone...');
ensurePrismaInStandalone(standaloneDir, projectRoot);
console.log('');

// Summary
const standaloneNm = path.join(standaloneDir, 'node_modules');
if (fs.existsSync(standaloneNm)) {
  const nmContents = fs.readdirSync(standaloneNm);
  console.log(`Standalone node_modules has ${nmContents.length} entries`);
  console.log(`  Includes: ${nmContents.filter(n => n.startsWith('@') || n.startsWith('.')).join(', ')}`);
}

console.log('');
console.log('=== Build complete! ===');