import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag === -1 ? process.env.PORT || 5173 : process.argv[portFlag + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Choose a valid port: node scripts/serve.mjs --port 5173');
  process.exit(1);
}
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const segments = pathname.split('/').filter(Boolean);
    const target = resolve(root, ...segments, ...(pathname.endsWith('/') ? ['index.html'] : []));
    const local = relative(root, target);
    if (local.startsWith('..') || isAbsolute(local) || segments.some(part => part.startsWith('.')) || /[\\\0]/.test(pathname)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!(await stat(target)).isFile()) throw new Error('Not found');
    const body = await readFile(target);
    response.writeHead(200, {
      'Content-Type': `${types[extname(target)] || 'application/octet-stream'}; charset=utf-8`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404).end('Not found');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Try --port ${port + 1}.` : error.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => console.log(`Breakin is ready: http://localhost:${port}\nPress Ctrl+C to stop.`));
