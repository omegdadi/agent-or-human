import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
await rm('_site', { recursive: true, force: true });
await mkdir('_site/lib', { recursive: true });
await cp('site', '_site', { recursive: true });
await cp('dist/index.js', '_site/lib/index.js');
await writeFile('_site/.nojekyll', '');
console.log('Built static demo in _site using the actual distributed library');
