import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
writeFileSync('dist/index.d.cts', readFileSync('dist/index.d.ts', 'utf8').replaceAll('./analytics.js', './analytics.cjs').replaceAll('./monitor.js', './monitor.cjs'));
writeFileSync('dist/analytics.d.cts', readFileSync('dist/analytics.d.ts', 'utf8').replaceAll('./index.js', './index.cjs').replaceAll('./pointer.js', './pointer.cjs'));
writeFileSync('dist/pointer.d.cts', readFileSync('dist/pointer.d.ts', 'utf8'));
writeFileSync('dist/monitor.d.cts', readFileSync('dist/monitor.d.ts', 'utf8').replaceAll('./analytics.js', './analytics.cjs').replaceAll('./index.js', './index.cjs'));
for (const [format, outfile] of [['esm', 'dist/index.js'], ['cjs', 'dist/index.cjs'], ['iife', 'dist/session-driver.global.js']]) {
  await build({ entryPoints: ['src/index.ts'], outfile, format, bundle: true, platform: 'browser', target: 'es2020', minify: true, ...(format === 'iife' ? { globalName: 'SessionDriver' } : {}) });
}
