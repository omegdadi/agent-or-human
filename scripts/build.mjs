import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
copyFileSync('dist/index.d.ts', 'dist/index.d.cts');
for (const [format, outfile] of [['esm', 'dist/index.js'], ['cjs', 'dist/index.cjs'], ['iife', 'dist/session-driver.global.js']]) {
  await build({ entryPoints: ['src/index.ts'], outfile, format, bundle: true, platform: 'browser', target: 'es2020', minify: true, ...(format === 'iife' ? { globalName: 'SessionDriver' } : {}) });
}
