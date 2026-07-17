// dev-server.js
// Tiny local development server — Node only, no packages to install.
//
//   npm run dev      (or: node dev-server.js)
//
// It does two things:
//   1. Serves the static site (index.html etc.) at http://localhost:3001
//   2. Handles POST /api/generate by calling the same generate() function
//      that Vercel will use in production (lib/generate.js)
//
// Your Anthropic API key is read from the .env.local file next to this
// script. That file is git-ignored, so the key never leaves your machine.
// The file is re-read on every request, so you can add/change the key
// without restarting the server.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './lib/generate.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3001; // 3000 is used by another local project

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

// --- minimal .env.local loader (KEY=VALUE lines, # comments allowed) ---
function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // strip optional surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) process.env[key] = value;
  }
}

function readJsonBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON in request body.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Cross-origin isolation — mirrors vercel.json so local dev matches
  // production. These enable SharedArrayBuffer, which lets the wasm
  // transcription backend run multithreaded (much faster). COEP
  // "credentialless" still allows the fonts / CDN / model to load.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

  // ---- API route ----
  if (url.pathname === '/api/generate') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
      return;
    }
    try {
      loadEnvLocal(); // pick up .env.local changes without a restart
      const { mode, transcript, episodeLink, guest } = await readJsonBody(req);
      const text = await generate({ mode, transcript, episodeLink, guest });
      sendJson(res, 200, { text });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed.';
      let status = 502;
      if (/Unknown mode|No transcript|Invalid JSON|too large/.test(message)) status = 400;
      else if (/ANTHROPIC_API_KEY/.test(message)) status = 500;
      sendJson(res, status, { error: message });
    }
    return;
  }

  // ---- static files ----
  let filePath = decodeURIComponent(url.pathname);
  if (filePath === '/' || filePath === '') filePath = '/index.html';

  // resolve safely inside the project folder (blocks ../ escapes)
  const resolved = path.normalize(path.join(ROOT, filePath));
  if (!resolved.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // never serve the secrets file or server code
  const base = path.basename(resolved);
  if (base === '.env.local' || base === '.env') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

loadEnvLocal();
server.listen(PORT, () => {
  console.log(`Scribe dev server running at http://localhost:${PORT}`);
  console.log(
    process.env.ANTHROPIC_API_KEY
      ? 'ANTHROPIC_API_KEY loaded from .env.local ✓'
      : 'NOTE: no ANTHROPIC_API_KEY found yet — create .env.local (copy .env.local.example) and add your key.'
  );
});
