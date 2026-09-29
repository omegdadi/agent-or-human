import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('_site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = pathname.replace(/^\/session-driver\//, '/');
  const path = resolve(root, '.' + (relative.endsWith('/') ? relative + 'index.html' : relative));
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
}).listen(4178, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:4178/session-driver/'));
