#!/usr/bin/env node
/**
 * Cross-platform build script for Electron + Next.js standalone.
 *
 * After `next build`, the standalone dir has its OWN traced node_modules
 * (only what Next.js detected the app uses). But it sometimes misses
 * sub-dependencies (e.g. styled-jsx). So we ALSO copy our runtime
 * dependencies from project node_modules as a fallback.
 *
 * We ONLY copy packages listed in package.json "dependencies" (NOT
 * devDependencies like electron, eslint, typescript, etc.) to keep
 * the package small.
 *
 * Size optimization: strip .md, .ts, .map, tests, docs from node_modules.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const UNNECESSARY_PATTERNS = [
  '*.md', '*.MD',
  '*.ts',
  '*.map',
  'LICENSE*', 'license*', 'LICENCE*', 'licence*',
  'AUTHORS*', 'CONTRIBUTORS*',
  '.eslintrc*', '.prettierrc*', 'tsconfig*.json', 'jest.config*',
  '*.test.js', '*.spec.js', '*.test.mjs', '*.spec.mjs',
  '*.test.cjs', '*.spec.cjs',
  '__tests__', '__mocks__', 'coverage', '.nyc_output',
  'docs', 'doc', 'example', 'examples', 'website',
  '.github', '.vscode', '.idea',
  'CHANGELOG*', 'HISTORY*', 'SECURITY*',
];

function shouldDelete(fileName) {
  for (const pattern of UNNECESSARY_PATTERNS) {
    if (pattern.includes('*')) {
      const parts = pattern.split('*');
      if (parts.length === 2 && fileName.startsWith(parts[0]) && fileName.endsWith(parts[1])) return true;
    } else if (fileName === pattern) {
      return true;
    }
  }
  return false;
}

function getDirSize(dirPath) {
  let size = 0;
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) size += getDirSize(full);
      else if (!entry.isSymbolicLink()) try { size += fs.statSync(full).size; } catch {}
    }
  } catch {}
  return size;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === '.git' || entry.name === '.cache') continue;
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      try {
        const realPath = fs.realpathSync(srcPath);
        if (fs.statSync(realPath).isDirectory()) copyDirSync(realPath, destPath);
        else fs.copyFileSync(realPath, destPath);
      } catch (err) { console.warn(`  Symlink warning: ${srcPath}`); }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function stripUnnecessaryFiles(dirPath) {
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.name === '.prisma') continue; // never touch native binaries
      if (entry.isDirectory()) {
        if (['.git', '.cache', 'coverage', '__tests__', '__mocks__',
             'docs', 'doc', 'example', 'examples', 'website',
             '.github', '.vscode', '.idea'].includes(entry.name)) {
          try { fs.rmSync(fullPath, { recursive: true, force: true }); } catch {}
          continue;
        }
        stripUnnecessaryFiles(fullPath);
      } else if (shouldDelete(entry.name)) {
        try { fs.unlinkSync(fullPath); } catch {}
      }
    }
  } catch {}
}

function ensurePrismaInStandalone(standaloneDir, projectRoot) {
  console.log('  Copying Prisma engine...');
  // Copy .prisma (generated client with native engine)
  const dotPrismaSrc = path.join(projectRoot, 'node_modules', '.prisma');
  if (fs.existsSync(dotPrismaSrc)) {
    copyDirSync(dotPrismaSrc, path.join(standaloneDir, 'node_modules', '.prisma'));
  }
  // Copy @prisma scope
  const prismaScopeSrc = path.join(projectRoot, 'node_modules', '@prisma');
  if (fs.existsSync(prismaScopeSrc)) {
    for (const entry of fs.readdirSync(prismaScopeSrc, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const src = path.join(prismaScopeSrc, entry.name);
        const dest = path.join(standaloneDir, 'node_modules', '@prisma', entry.name);
        copyDirSync(src, dest);
      }
    }
  }
  // Verify
  const engineDir = path.join(standaloneDir, 'node_modules', '.prisma', 'client');
  if (fs.existsSync(engineDir)) {
    const nodeFiles = fs.readdirSync(engineDir).filter(f => f.endsWith('.node'));
    console.log(`  Engine binaries: ${nodeFiles.join(', ') || 'NONE (library mode?)'}`);
  }
}

// ============================================================
// MAIN
// ============================================================
const projectRoot = path.resolve(__dirname, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const pkg = require(path.join(projectRoot, 'package.json'));

console.log('=== Building Next.js standalone for Electron ===');
console.log(`Project root: ${projectRoot}`);
console.log(`Platform: ${process.platform} | Node: ${process.version}`);
console.log('');

// Step 1: next build
console.log('[1/6] Running next build...');
try {
  execSync('npx next build', {
    cwd: projectRoot, stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
} catch { console.error('next build failed!'); process.exit(1); }

if (!fs.existsSync(standaloneDir)) {
  console.error('ERROR: .next/standalone not created.');
  process.exit(1);
}
console.log('[2/6] Build complete.\n');

// Step 2: Copy static assets
console.log('[3/6] Copying static assets...');
const staticSrc = path.join(projectRoot, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) { copyDirSync(staticSrc, staticDest); console.log('  .next/static copied'); }

const publicSrc = path.join(projectRoot, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) { copyDirSync(publicSrc, publicDest); console.log('  public/ copied'); }
console.log('');

// Step 3: Copy only RUNTIME dependencies (from package.json "dependencies")
// into standalone node_modules. Skip devDependencies entirely.
console.log('[4/6] Ensuring runtime dependencies in standalone...');
const standaloneNm = path.join(standaloneDir, 'node_modules');
const projectNm = path.join(projectRoot, 'node_modules');

// Get runtime dep names
const runtimeDeps = Object.keys(pkg.dependencies || {});
console.log(`  Runtime dependencies: ${runtimeDeps.length} packages`);

let copiedCount = 0;
for (const dep of runtimeDeps) {
  const srcPath = path.join(projectNm, dep);
  const destPath = path.join(standaloneNm, dep);
  if (!fs.existsSync(destPath) && fs.existsSync(srcPath)) {
    console.log(`  Copying: ${dep}`);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
    copiedCount++;
  }
}
console.log(`  Copied ${copiedCount} missing runtime deps.\n`);

// Step 4: Also copy sub-deps that next relies on but standalone tracer may miss
// These are known sub-dependencies of Next.js that may not be traced
const knownNextSubDeps = [
  'styled-jsx', 'postcss', 'autoprefixer', 'cssnano', 'nanoid',
  'picocolors', 'ansi-styles', 'color-convert', 'color-name',
  'has-flag', 'supports-color', 'chalk', 'optimism',
];
console.log('[4b/6] Checking known Next.js sub-dependencies...');
for (const dep of knownNextSubDeps) {
  const srcPath = path.join(projectNm, dep);
  const destPath = path.join(standaloneNm, dep);
  if (!fs.existsSync(destPath) && fs.existsSync(srcPath)) {
    console.log(`  Copying missing sub-dep: ${dep}`);
    copyDirSync(srcPath, destPath);
  }
}
console.log('');

// Step 5: Prisma engine
console.log('[5/6] Prisma engine files...');
ensurePrismaInStandalone(standaloneDir, projectRoot);
console.log('');

// Step 6: Strip unnecessary files
console.log('[6/6] Stripping unnecessary files...');
const nmBefore = getDirSize(standaloneNm);
stripUnnecessaryFiles(standaloneNm);
const nmAfter = getDirSize(standaloneNm);
console.log(`  node_modules: ${formatSize(nmBefore)} -> ${formatSize(nmAfter)} (saved ${formatSize(nmBefore - nmAfter)})`);
console.log('');

// Final verification
console.log('=== Final Verification ===');
const checks = [
  ['server.js', path.join(standaloneDir, 'server.js')],
  ['next', path.join(standaloneNm, 'next')],
  ['styled-jsx', path.join(standaloneNm, 'styled-jsx')],
  ['react', path.join(standaloneNm, 'react')],
  ['react-dom', path.join(standaloneNm, 'react-dom')],
  ['@prisma/client', path.join(standaloneNm, '@prisma', 'client')],
  ['.prisma/client', path.join(standaloneNm, '.prisma', 'client')],
  ['.next/static', path.join(standaloneDir, '.next', 'static')],
  ['public/', path.join(standaloneDir, 'public')],
];

let allOk = true;
for (const [name, p] of checks) {
  const ok = fs.existsSync(p);
  console.log(`  ${ok ? 'OK' : 'MISSING!'} ${name}`);
  if (!ok) allOk = false;
}

const totalSize = getDirSize(standaloneDir);
console.log(`\nTotal standalone size: ${formatSize(totalSize)}`);

if (!allOk) { console.error('\nFATAL: Missing files!'); process.exit(1); }
console.log('\n=== Build complete! All checks passed. ===');