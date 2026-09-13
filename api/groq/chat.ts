/**
 * SERVER-SIDE GROQ CHAT PROXY (PRD §40 Security Checklist)
 *
 * "Groq key is server-side" — the browser never sees, stores, or transmits
 * the API key. Vercel injects GROQ_API_KEY from environment variables and
 * this function is the only place it is read.
 *
 * Hardening:
 * - POST-only, JSON body, hard 64KB payload cap
 * - Model allowlist (client model choice cannot be used for abuse)
 * - Message count/length caps (LLM context abuse guard)
 * - Errors are sanitized; provider messages pass through only via the
 *   upstream error text (no headers, no key fragments, no stack)
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '64kb'
    }
  }
}

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Model catalog (Sept 2026 Groq rotation): the legacy Llama-3.3/3.1/Mixtral
 * free-tier slugs were retired, so the proxy now serves gpt-oss-120b by
 * default and transparently aliases every legacy slug clients may still
 * send from persisted settings. Only models on this list are ever requested
 * upstream — client model choice cannot be used for abuse.
 */
const DEFAULT_MODEL = 'openai/gpt-oss-120b'

const ALLOWED_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'groq/compound',
  'groq/compound-mini',
  'qwen/qwen3.8-27b',
  'allam-2-7b'
])

/** Legacy slugs → current equivalents (settings saved before the rotation). */
const MODEL_ALIASES: Record<string, string> = {
  'llama-3.3-70b-versatile': DEFAULT_MODEL,
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'mixtral-8x7b-32768': DEFAULT_MODEL
}
const MAX_MESSAGES = 24
const MAX_MESSAGE_CHARS = 12000
const MAX_TOTAL_CHARS = 40000

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function json(res: any, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (raw.length > MAX_MESSAGES) return null

  const messages: ChatMessage[] = []
  let totalChars = 0

  for (const m of raw) {
    const role = (m as any)?.role
    const content = (m as any)?.content
    if ((role !== 'system' && role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return null
    }
    if (content.length > MAX_MESSAGE_CHARS) return null
    totalChars += content.length
    messages.push({ role, content })
  }

  if (totalChars > MAX_TOTAL_CHARS) return null
  return messages
}

export default async function handler(req: any, res: any) {
  // Method + content-type gate
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed. Use POST with a JSON body.' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !apiKey.trim()) {
    // 503: the deployment is missing configuration — actionable, not a client bug.
    return json(res, 503, {
      error: 'AI service is not configured on this deployment. Set the GROQ_API_KEY environment variable in Vercel project settings.'
    })
  }

  let body: any
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return json(res, 400, { error: 'Request body must be valid JSON.' })
  }

  const messages = sanitizeMessages(body?.messages)
  if (!messages) {
    return json(res, 400, { error: 'Invalid messages payload.' })
  }

  const requestedModel = typeof body?.model === 'string' ? body.model : DEFAULT_MODEL
  const model = ALLOWED_MODELS.has(requestedModel)
    ? requestedModel
    : (MODEL_ALIASES[requestedModel] || DEFAULT_MODEL)

  try {
    const upstream = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: typeof body?.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 1) : 0.1,
        max_tokens: 1024
      })
    })

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => null)
      const upstreamMessage = err?.error?.message
      return json(res, upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status, {
        error: upstreamMessage
          ? `Groq request failed: ${upstreamMessage}`
          : `Groq request failed (HTTP ${upstream.status}).`
      })
    }

    const data = await upstream.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      return json(res, 502, { error: 'Groq returned an unexpected response shape.' })
    }

    return json(res, 200, { content, model: data.model || model, usage: data.usage ?? null })
  } catch (e: any) {
    // Network failure to upstream — sanitized, no internals exposed.
    return json(res, 502, { error: 'Could not reach the Groq AI service. Try again.' })
  }
}
