#!/usr/bin/env node
/**
 * Cross-platform build script for Electron + Next.js standalone (WINDOWS ONLY).
 *
 * Size optimizations:
 * - Only copies runtime deps (not devDependencies)
 * - Strips non-Windows prebuilds from serialport/prisma
 * - Strips .md, .ts, .map, tests, docs, examples
 * - Removes source maps, TypeScript declarations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// File patterns to delete
const UNNECESSARY_PATTERNS = [
  '*.md', '*.MD',
  '*.ts', '*.tsx', '*.mts', '*.cts',
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
  'README*', 'readme*', 'Readme*',
  '.editorconfig', '.npmignore', '.gitignore',
  'Makefile', 'Gulpfile*', 'Gruntfile*',
  '*.tgz', '*.log',
];

// Directory names to delete entirely
const UNNECESSARY_DIRS = [
  '.git', '.cache', 'coverage', '__tests__', '__mocks__',
  'docs', 'doc', 'example', 'examples', 'website',
  '.github', '.vscode', '.idea', 'test', 'tests',
  'typescript', 'ts', 'src', 'scripts',
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
      // Never touch native binary directories
      if (entry.name === '.prisma' || entry.name === 'prebuilds' || entry.name === 'prebuild-install') continue;
      if (entry.isDirectory()) {
        if (UNNECESSARY_DIRS.includes(entry.name)) {
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

/**
 * Remove non-Windows prebuilt binaries from serialport and other native modules.
 * This is the BIGGEST size saver - serialport includes prebuilds for:
 * - Windows x64, Windows arm64
 * - Linux x64, Linux arm64, Linux armv7
 * - macOS x64, macOS arm64
 * We only need: Windows x64
 */
function stripNonWindowsBinaries(standaloneNm) {
  console.log('  Stripping non-Windows native binaries...');
  let savedBytes = 0;

  // Walk through all packages looking for prebuilds directories
  const walkDir = (dir) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (!entry.isDirectory()) continue;

        // Handle prebuilds directory (used by prebuild-install / @mapbox/node-pre-gyp)
        if (entry.name === 'prebuilds') {
          const platDir = path.join(fullPath);
          try {
            for (const plat of fs.readdirSync(platDir)) {
              // Only keep 'win32-x64'
              if (plat !== 'win32-x64') {
                const platPath = path.join(platDir, plat);
                const size = getDirSize(platPath);
                if (size > 0) {
                  savedBytes += size;
                  fs.rmSync(platPath, { recursive: true, force: true });
                  console.log(`    Removed prebuild: ${plat} (${formatSize(size)})`);
                }
              }
            }
          } catch {}
          continue;
        }

        // Handle node-pre-gyp style directories (used by some older native modules)
        if (entry.name === 'lib' || entry.name === 'binaries') {
          const libDir = path.join(fullPath);
          try {
            for (const sub of fs.readdirSync(libDir, { withFileTypes: true })) {
              if (sub.isDirectory()) {
                const subPath = path.join(libDir, sub.name);
                // Check if it's a platform-specific directory
                if (sub.name.includes('linux') || sub.name.includes('darwin') ||
                    sub.name.includes('macos') || sub.name.includes('arm64') ||
                    sub.name.includes('armv') || sub.name.includes('musl')) {
                  if (!sub.name.includes('win32') && !sub.name.includes('win')) {
                    const size = getDirSize(subPath);
                    if (size > 0) {
                      savedBytes += size;
                      fs.rmSync(subPath, { recursive: true, force: true });
                    }
                  }
                }
              }
            }
          } catch {}
        }

        // Recurse
        walkDir(fullPath);
      }
    } catch {}
  };

  walkDir(standaloneNm);
  console.log(`  Saved ${formatSize(savedBytes)} from non-Windows binaries`);
  return savedBytes;
}

/**
 * Remove non-Windows Prisma engine binaries
 */
function stripNonWindowsPrisma(standaloneNm) {
  console.log('  Stripping non-Windows Prisma engines...');
  let savedBytes = 0;

  const prismaDirs = [
    path.join(standaloneNm, '.prisma', 'client'),
  ];

  for (const dir of prismaDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const file of fs.readdirSync(dir)) {
        // Prisma engines follow pattern: libquery_engine-OS-ARCH.node
        // We want: libquery_engine-windows.dll.node (or similar)
        // Remove: linux, darwin, macos, arm64 versions
        const lower = file.toLowerCase();
        if (lower.includes('linux') || lower.includes('darwin') ||
            lower.includes('macos') || (lower.includes('arm64') && !lower.includes('windows'))) {
          const filePath = path.join(dir, file);
          const size = fs.statSync(filePath).size;
          savedBytes += size;
          fs.unlinkSync(filePath);
          console.log(`    Removed: ${file} (${formatSize(size)})`);
        }
      }
    } catch {}
  }

  console.log(`  Saved ${formatSize(savedBytes)} from non-Windows Prisma engines`);
  return savedBytes;
}

function ensurePrismaInStandalone(standaloneDir, projectRoot) {
  console.log('  Copying Prisma engine...');
  const dotPrismaSrc = path.join(projectRoot, 'node_modules', '.prisma');
  if (fs.existsSync(dotPrismaSrc)) {
    copyDirSync(dotPrismaSrc, path.join(standaloneDir, 'node_modules', '.prisma'));
  }
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
}

// ============================================================
// MAIN
// ============================================================
const projectRoot = path.resolve(__dirname, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const pkg = require(path.join(projectRoot, 'package.json'));

console.log('=== Building Next.js standalone for Electron (Windows) ===');
console.log(`Project root: ${projectRoot}`);
console.log(`Platform: ${process.platform} | Node: ${process.version}`);
console.log('');

// Step 1: next build
console.log('[1/7] Running next build...');
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
console.log('[2/7] Build complete.\n');

// Step 2: Copy static assets
console.log('[3/7] Copying static assets...');
const staticSrc = path.join(projectRoot, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) { copyDirSync(staticSrc, staticDest); console.log('  .next/static copied'); }

const publicSrc = path.join(projectRoot, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) { copyDirSync(publicSrc, publicDest); console.log('  public/ copied'); }
console.log('');

// Step 3: Copy only RUNTIME dependencies
console.log('[4/7] Ensuring runtime dependencies in standalone...');
const standaloneNm = path.join(standaloneDir, 'node_modules');
const projectNm = path.join(projectRoot, 'node_modules');

const runtimeDeps = Object.keys(pkg.dependencies || {}).filter(dep =>
  // Skip packages only used by Electron main process (not Next.js server)
  !['serialport', 'electron-log', 'electron-updater'].includes(dep)
);
console.log(`  Runtime dependencies for standalone: ${runtimeDeps.length} packages (skipped: serialport, electron-log, electron-updater)`);

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

// Step 4: Copy known Next.js sub-dependencies
const knownNextSubDeps = [
  'styled-jsx', 'postcss', 'autoprefixer', 'cssnano', 'nanoid',
  'picocolors', 'ansi-styles', 'color-convert', 'color-name',
  'has-flag', 'supports-color', 'chalk', 'optimism',
];
console.log('[4b/7] Checking known Next.js sub-dependencies...');
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
console.log('[5/7] Prisma engine files...');
ensurePrismaInStandalone(standaloneDir, projectRoot);
console.log('');

// Step 6: Strip non-Windows binaries (BIGGEST size saver)
console.log('[6/7] Stripping non-Windows native binaries...');
stripNonWindowsBinaries(standaloneNm);
stripNonWindowsPrisma(standaloneNm);
console.log('');

// Step 7: Strip unnecessary files
console.log('[7/7] Stripping unnecessary files...');
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