import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load .env.local and .env (override process environment)
const rootDir = process.cwd();
dotenv.config({ path: path.resolve(rootDir, '.env.local'), override: true });
dotenv.config({ path: path.resolve(rootDir, '.env'), override: false });

import apiHandler from '../api/_core/api';
import oauthHandler from '../api/_core/oauth';

const PORT = parseInt(process.env.PORT || '8888', 10);
const DIST_DIR = path.resolve(rootDir, 'frontend/packages/webapp/dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wxml': 'application/xml; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

async function nodeToWebRequest(req: http.IncomingMessage, fullUrl: string): Promise<Request> {
  const method = req.method || 'GET';
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else {
      headers.set(key, value);
    }
  }

  let body: Buffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    body = Buffer.concat(chunks);
  }

  return new Request(fullUrl, {
    method,
    headers,
    body: body && body.length > 0 ? body : undefined,
    // @ts-ignore
    duplex: 'half',
  });
}

async function sendWebResponse(webRes: Response, res: http.ServerResponse): Promise<void> {
  res.statusCode = webRes.status;
  
  // Set-Cookie handling
  const rawSetCookies = typeof (webRes.headers as any).getSetCookie === 'function'
    ? (webRes.headers as any).getSetCookie()
    : undefined;

  webRes.headers.forEach((val, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      return;
    }
    res.setHeader(key, val);
  });

  if (rawSetCookies && rawSetCookies.length > 0) {
    res.setHeader('Set-Cookie', rawSetCookies);
  } else {
    const singleCookie = webRes.headers.get('set-cookie');
    if (singleCookie) {
      res.setHeader('Set-Cookie', singleCookie);
    }
  }

  if (!webRes.body) {
    res.end();
    return;
  }

  const arrayBuffer = await webRes.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

function serveStatic(reqPath: string, res: http.ServerResponse): boolean {
  let safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  if (safePath.startsWith('/') || safePath.startsWith('\\')) {
    safePath = safePath.slice(1);
  }

  const filePath = path.join(DIST_DIR, safePath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // SPA fallback for non-file routes
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const fullUrl = `http://${host}${req.url}`;
    const parsed = new URL(fullUrl);
    const pathname = parsed.pathname;

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

    // 1. Route OAuth endpoints
    if (
      pathname.startsWith('/api/restful/oauth2') ||
      pathname.startsWith('/oauth2') ||
      pathname.startsWith('/login/oauth2')
    ) {
      const webReq = await nodeToWebRequest(req, fullUrl);
      const webRes = await oauthHandler(webReq);
      await sendWebResponse(webRes, res);
      return;
    }

    // 2. Route API endpoints
    if (pathname.startsWith('/api/restful')) {
      const webReq = await nodeToWebRequest(req, fullUrl);
      const webRes = await apiHandler(webReq);
      await sendWebResponse(webRes, res);
      return;
    }

    // 3. Static assets & SPA routes
    if (serveStatic(pathname, res)) {
      return;
    }

    res.statusCode = 404;
    res.end('Not Found');
  } catch (err: any) {
    console.error('Server error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error: ' + err.message);
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(` WiseMapping Private Edition Local Server Running`);
  console.log(` Local URL : http://localhost:${PORT}`);
  console.log(` Login URL : http://localhost:${PORT}/c/login`);
  console.log(`==================================================`);
});
