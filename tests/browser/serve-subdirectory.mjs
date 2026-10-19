// QA-only static server: reproduce GitHub Pages repository asset paths.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const prefixes = ['/chillwave-drive/', '/vaporwave-parkour/'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain', '.wav': 'audio/wav', '.json': 'application/json' };
http.createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const prefix = prefixes.find(prefix => path.startsWith(prefix));
    if (!prefix) { response.writeHead(404).end(); return; }
    const file = resolve(root, path.slice(prefix.length) || 'index.html');
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if (!(await stat(file)).isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end(); }
}).listen(4174, '127.0.0.1', () => console.log('Pages QA: serving only dist under /chillwave-drive/ and /vaporwave-parkour/'));
