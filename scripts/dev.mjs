/**
 * LOCAL DEV API EMULATOR + VITE LAUNCHER
 *
 * Production runs api/groq/*.ts as Vercel serverless functions. For local
 * development this script provides the same three endpoints on :3001 and
 * then starts Vite (which proxies /api → :3001 via vite.config.ts).
 *
 * The GROQ_API_KEY is read from the environment or .env — it stays on the
 * machine, never in the browser bundle.
 *
 * Usage: npm run dev
 */

import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const PORT = 3001;
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

// --- minimal .env loader (KEY=VALUE lines) ---------------------------------
for (const line of ['.env', '.env.local'].flatMap(f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n') : [])) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

//
// Model catalog mirrors api/groq/chat.ts: legacy Llama/Mixtral slugs were
// retired from Groq's free tier (Sept 2026 rotation), so the default is
// gpt-oss-120b and legacy slugs are aliased for old persisted settings.
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const ALLOWED_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'groq/compound',
  'groq/compound-mini',
  'qwen/qwen3.8-27b',
  'allam-2-7b'
]);
const MODEL_ALIASES = {
  'llama-3.3-70b-versatile': DEFAULT_MODEL,
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'mixtral-8x7b-32768': DEFAULT_MODEL
};
const WHISPER_PROMPT =
  'Pakistani industrial manufacturing ERP, cotton yarn, reactive dye, purchase order, sales invoice, 18% GST, FBR compliance, Urdu Roman and English commands';

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function groqStatus(res) {
  if (!GROQ_API_KEY) {
    return json(res, 503, {
      success: false,
      configured: false,
      message: 'GROQ_API_KEY is not set locally. Add it to your .env file.'
    });
  }
  try {
    const started = Date.now();
    const r = await fetch(`${GROQ_BASE}/models`, { headers: { Authorization: `Bearer ${GROQ_API_KEY}` } });
    const latencyMs = Date.now() - started;
    if (!r.ok) {
      return json(res, 502, { success: false, configured: true, message: `Server key rejected by Groq (HTTP ${r.status}).` });
    }
    const d = await r.json();
    const models = (d.data || []).map(m => m.id);
    const hasChatModel = models.some(m => m === DEFAULT_MODEL);
    return json(res, 200, {
      success: hasChatModel,
      configured: true,
      model: hasChatModel ? DEFAULT_MODEL : (models[0] || 'unknown'),
      modelCount: models.length,
      latencyMs,
      message: hasChatModel
        ? `Connected via local server proxy (${models.length} models active).`
        : 'Key accepted, but the default chat model is not available on this Groq account.'
    });
  } catch {
    return json(res, 502, { success: false, configured: true, message: 'Could not reach Groq from the server.' });
  }
}

async function groqChat(req, res) {
  if (!GROQ_API_KEY) {
    return json(res, 503, {
      error: 'AI service is not configured locally. Set GROQ_API_KEY in your .env file.'
    });
  }
  let body;
  try {
    body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8'));
  } catch (e) {
    return json(res, e.status || 400, { error: e.status ? e.message : 'Invalid JSON body.' });
  }
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || !messages.length || messages.some(m => !m?.role || typeof m?.content !== 'string')) {
    return json(res, 400, { error: 'Invalid messages payload.' });
  }
  const requestedModel = typeof body?.model === 'string' && body.model ? body.model : DEFAULT_MODEL;
  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : (MODEL_ALIASES[requestedModel] || DEFAULT_MODEL);
  try {
    const r = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 1024 })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      return json(res, r.status === 401 || r.status === 403 ? 502 : r.status, {
        error: d?.error?.message || `Groq request failed (HTTP ${r.status}).`
      });
    }
    return json(res, 200, { content: d?.choices?.[0]?.message?.content || '', model: d?.model || model });
  } catch {
    return json(res, 502, { error: 'Could not reach the Groq AI service. Try again.' });
  }
}

async function groqTranscribe(req, res) {
  if (!GROQ_API_KEY) {
    return json(res, 503, {
      error: 'Voice transcription is not configured locally. Set GROQ_API_KEY in your .env file.'
    });
  }
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return json(res, 400, { error: 'Request must be multipart/form-data with an audio file.' });
  }
  let raw;
  try {
    raw = await readBody(req, MAX_AUDIO_BYTES);
  } catch (e) {
    return json(res, e.status || 413, { error: e.status ? e.message : 'Audio upload failed.' });
  }
  if (!raw.length) {
    return json(res, 413, { error: 'Audio file is empty.' });
  }
  try {
    const upstream = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': contentType },
      body: raw // raw multipart passthrough: original bytes + original boundary header
    });
    const d = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return json(res, upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status, {
        error: d?.error?.message || `Transcription failed (HTTP ${upstream.status}).`
      });
    }
    return json(res, 200, { text: (d?.text || '').trim() });
  } catch {
    return json(res, 502, { error: 'Could not reach the Groq transcription service. Try again.' });
  }
}

const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  if (req.method === 'GET' && url === '/api/groq/status') return groqStatus(res);
  if (req.method === 'POST' && url === '/api/groq/chat') return groqChat(req, res);
  if (req.method === 'POST' && url === '/api/groq/transcribe') return groqTranscribe(req, res);
  return json(res, 404, { error: 'Not found.' });
});

server.listen(PORT, () => {
  console.log(`  [api] Groq proxy emulator on http://localhost:${PORT} (key ${((process.env.GROQ_API_KEY || '').trim()) ? 'loaded' : 'NOT SET — AI features will report 503'})`);

  // Launch Vite with the same flags as the old dev script.
  // No shell:true — process.execPath may contain spaces ("C:\Program Files\...").
  const vite = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    '--port=3000',
    '--host=0.0.0.0'
  ], { stdio: 'inherit' });

  vite.on('exit', code => {
    server.close();
    process.exit(code ?? 0);
  });
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close();
    process.exit(0);
  });
}
