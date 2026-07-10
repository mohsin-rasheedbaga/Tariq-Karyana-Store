#!/usr/bin/env node
/**
 * Cross-platform build script for Electron + Next.js standalone.
 * Works on Windows, Linux, and macOS (no cp -r).
 *
 * 1. Runs `next build` with standalone output
 * 2. Copies `.next/static` into `.next/standalone/.next/static`
 * 3. Copies `public/` into `.next/standalone/public/`
 * 4. Verifies critical modules (next, react, etc.) exist in standalone node_modules
 * 5. Copies any missing critical modules from project node_modules
 * 6. Ensures Prisma engine files are available
 * 7. Verifies the final standalone directory is complete
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  const srcStat = fs.statSync(src);
  if (!srcStat.isDirectory()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return;
  }

  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip .git, .cache directories
    if (entry.name === '.git' || entry.name === '.cache') continue;

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      try {
        const realPath = fs.realpathSync(srcPath);
        const realStat = fs.statSync(realPath);
        if (realStat.isDirectory()) {
          copyDirSync(realPath, destPath);
        } else {
          fs.copyFileSync(realPath, destPath);
        }
      } catch (err) {
        console.warn(`  Warning: Could not resolve symlink ${srcPath}: ${err.message}`);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Ensure a module exists in standalone's node_modules.
 * If not, copy it from the project's node_modules.
 */
function ensureModule(standaloneDir, projectRoot, moduleName) {
  const destPath = path.join(standaloneDir, 'node_modules', moduleName);
  const srcPath = path.join(projectRoot, 'node_modules', moduleName);

  if (fs.existsSync(destPath)) {
    // Module already exists in standalone
    const stat = fs.statSync(destPath);
    const isDir = stat.isDirectory();
    console.log(`  [OK] ${moduleName} exists in standalone (${isDir ? 'dir' : 'file'})`);
    return true;
  }

  if (fs.existsSync(srcPath)) {
    console.log(`  [COPY] ${moduleName} missing from standalone, copying from project...`);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`  [DONE] ${moduleName} copied`);
    return true;
  }

  console.error(`  [FAIL] ${moduleName} NOT found in standalone or project node_modules!`);
  return false;
}

function ensurePrismaInStandalone(standaloneDir, projectRoot) {
  console.log('  Ensuring Prisma modules...');

  // Copy the generated Prisma client (includes native query engine binaries)
  ensureModule(standaloneDir, projectRoot, '.prisma');

  // Copy the entire @prisma scope
  const prismaScopeSrc = path.join(projectRoot, 'node_modules', '@prisma');
  if (fs.existsSync(prismaScopeSrc)) {
    const entries = fs.readdirSync(prismaScopeSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        ensureModule(standaloneDir, projectRoot, `@prisma/${entry.name}`);
      }
    }
  }

  // List engine files for verification
  const prismaClientDir = path.join(standaloneDir, 'node_modules', '.prisma', 'client');
  if (fs.existsSync(prismaClientDir)) {
    const files = fs.readdirSync(prismaClientDir);
    const nodeFiles = files.filter(f => f.endsWith('.node'));
    console.log(`  .prisma/client has ${files.length} files, ${nodeFiles.length} native binaries`);
    if (nodeFiles.length > 0) {
      console.log(`  Engine binaries: ${nodeFiles.join(', ')}`);
    }
  } else {
    console.warn(`  WARNING: .prisma/client not found!`);
  }
}

// ============================================================
// MAIN
// ============================================================
const projectRoot = path.resolve(__dirname, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');

console.log('=== Building Next.js standalone for Electron ===');
console.log(`Project root: ${projectRoot}`);
console.log(`Standalone dir: ${standaloneDir}`);
console.log(`Platform: ${process.platform}`);
console.log(`Node: ${process.version}`);
console.log('');

// Step 1: Run next build
console.log('[1/6] Running next build...');
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
console.log('[2/6] Next.js build complete, standalone directory created.');
console.log('');

// Step 2: Copy .next/static into .next/standalone/.next/static
console.log('[3/6] Copying static assets...');
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

// Step 4: Verify and copy critical modules that standalone MUST have
console.log('[4/6] Verifying critical modules in standalone node_modules...');
const criticalModules = [
  'next',
  'react',
  'react-dom',
  'next-auth',
  'next-intl',
  'next-themes',
];

let allCriticalFound = true;
for (const mod of criticalModules) {
  if (!ensureModule(standaloneDir, projectRoot, mod)) {
    allCriticalFound = false;
  }
}
console.log('');

if (!allCriticalFound) {
  console.error('FATAL: Some critical modules are missing! The standalone server will not work.');
  process.exit(1);
}

// Step 5: Ensure Prisma engine files are in standalone
console.log('[5/6] Ensuring Prisma engine files in standalone...');
ensurePrismaInStandalone(standaloneDir, projectRoot);
console.log('');

// Step 6: Final verification
console.log('[6/6] Final verification...');
const standaloneNm = path.join(standaloneDir, 'node_modules');
if (fs.existsSync(standaloneNm)) {
  const nmContents = fs.readdirSync(standaloneNm);
  console.log(`  node_modules has ${nmContents.length} entries`);

  // Check the most critical one: next
  const nextExists = fs.existsSync(path.join(standaloneNm, 'next'));
  const serverJsExists = fs.existsSync(path.join(standaloneDir, 'server.js'));
  const staticExists = fs.existsSync(path.join(standaloneDir, '.next', 'static'));
  const publicExists = fs.existsSync(path.join(standaloneDir, 'public'));

  console.log(`  server.js: ${serverJsExists ? 'YES' : 'MISSING!'}`);
  console.log(`  next module: ${nextExists ? 'YES' : 'MISSING!'}`);
  console.log(`  .next/static: ${staticExists ? 'YES' : 'MISSING!'}`);
  console.log(`  public/: ${publicExists ? 'YES' : 'MISSING!'}`);

  if (!nextExists) {
    console.error('FATAL: "next" module is missing from standalone/node_modules!');
    process.exit(1);
  }
  if (!serverJsExists) {
    console.error('FATAL: server.js is missing from standalone!');
    process.exit(1);
  }
} else {
  console.error('FATAL: standalone/node_modules does not exist!');
  process.exit(1);
}

console.log('');
console.log('=== Build complete! All checks passed. ===');