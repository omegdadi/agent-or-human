import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
await rm('_site', { recursive: true, force: true });
await mkdir('_site/lib', { recursive: true });
await cp('site', '_site', { recursive: true });
await cp('dist/index.js', '_site/lib/index.js');
await writeFile('_site/.nojekyll', '');
// Same-origin, pinned optional demo dependency; core package never imports BotD.
const { build } = await import('esbuild');
await build({ entryPoints: ['node_modules/@fingerprintjs/botd/dist/botd.esm.js'], outfile: '_site/lib/botd.js', bundle: true, format: 'esm', minify: true, target: 'es2020' });
await cp('node_modules/@fingerprintjs/botd/LICENSE', '_site/lib/BotD-LICENSE.txt');

console.log('Built static demo and optional BotD comparison in _site');
