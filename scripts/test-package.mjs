import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const run = (args, cwd = process.cwd()) => execFileSync('npm', args, { cwd, encoding: 'utf8' });
const packed = JSON.parse(run(['pack', '--json', '--ignore-scripts']))[0];
assert.equal(packed.files.some(f => f.path.startsWith('node_modules/')), false);
const temp = mkdtempSync(join(tmpdir(), 'session-driver-consumer-'));
try {
  writeFileSync(join(temp, 'package.json'), '{"private":true,"type":"module"}');
  run(['install', '--ignore-scripts', '--no-audit', '--no-fund', resolve(packed.filename)], temp);
  for (const [filename, source] of [['consumer.mjs', `import {detectSession,createSessionClassifier} from '@omegdadi/session-driver'; if(createSessionClassifier().getSnapshot().environment!=='unsupported')throw Error('analytics ESM failed'); if(detectSession().verdict!=='unsupported')throw Error('ESM failed');`], ['consumer.cjs', `const {detectSession,createSessionClassifier}=require('@omegdadi/session-driver'); if(createSessionClassifier().getSnapshot().environment!=='unsupported')throw Error('analytics CJS failed'); if(detectSession().verdict!=='unsupported')throw Error('CJS failed');`]]) {
    writeFileSync(join(temp, filename), source); execFileSync(process.execPath, [filename], { cwd: temp });
  }
  console.log(`Packed consumer ESM/CJS passed; tarball ${packed.size} bytes, unpacked ${packed.unpackedSize} bytes`);
} finally { rmSync(temp, { recursive: true, force: true }); rmSync(packed.filename); }
