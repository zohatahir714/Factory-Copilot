/**
 * SERVER-SIDE GROQ WHISPER PROXY (PRD §40 Security Checklist)
 *
 * Voice transcription endpoint: the browser uploads the audio Blob here and
 * this serverless function forwards it to Groq Whisper large-v3 with the
 * server-held key. The key never reaches the client.
 *
 * Hardening:
 * - POST-only, multipart/form-data (parsed manually — Vercel's Node runtime
 *   has no req.formData(), so the previous version rejected every upload)
 * - 20MB hard cap enforced while streaming the body in
 * - Audio MIME allowlist (webm / mp4 / wav / mpeg / ogg)
 * - No client-controlled model: always whisper-large-v3
 */

const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MAX_AUDIO_BYTES = 20 * 1024 * 1024

const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'video/webm'
])

const WHISPER_PROMPT =
  'Pakistani industrial manufacturing ERP, cotton yarn, reactive dye, purchase order, sales invoice, 18% GST, FBR compliance, Urdu Roman and English commands'

function json(res: any, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

interface Part {
  name: string
  filename?: string
  type?: string
  data: Buffer
}

/** Minimal multipart/form-data parser for the fields this endpoint uses. */
function parseMultipart(body: Buffer, boundary: string): Part[] {
  const parts: Part[] = []
  const delim = Buffer.from(`--${boundary}`)
  let idx = body.indexOf(delim)
  while (idx !== -1) {
    const next = body.indexOf(delim, idx + delim.length)
    if (next === -1) break

    let part = body.subarray(idx + delim.length, next)
    if (part.length >= 2 && part[0] === 13 && part[1] === 10) part = part.subarray(2)
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2)
    }

    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd !== -1) {
      const headerText = part.subarray(0, headerEnd).toString('utf8')
      const data = part.subarray(headerEnd + 4)
      const nameMatch = /name="([^"]*)"/.exec(headerText)
      const fileMatch = /filename="([^"]*)"/.exec(headerText)
      const typeMatch = /content-type:\s*([^\r\n;]+)/i.exec(headerText)
      parts.push({
        name: nameMatch?.[1] || '',
        filename: fileMatch?.[1],
        type: typeMatch?.[1]?.trim(),
        data
      })
    }
    idx = next
  }
  return parts
}

/** Stream the request body into a buffer with a hard cap. */
function readRawBody(req: any, limitBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limitBytes) {
        reject(Object.assign(new Error('too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed. Use POST with multipart/form-data.' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !apiKey.trim()) {
    return json(res, 503, {
      error: 'Voice transcription is not configured on this deployment. Set the GROQ_API_KEY environment variable in Vercel project settings.'
    })
  }

  const contentType = String(req.headers['content-type'] || '')
  if (!contentType.includes('multipart/form-data')) {
    return json(res, 400, { error: 'Request must be multipart/form-data with an audio file.' })
  }

  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
  if (!boundary) {
    return json(res, 400, { error: 'Malformed multipart request: missing boundary.' })
  }

  let raw: Buffer
  try {
    raw = await readRawBody(req, MAX_AUDIO_BYTES)
  } catch (e: any) {
    return json(res, e?.status || 400, {
      error: e?.status ? 'Audio file exceeds the 20MB limit.' : 'Failed to read the audio upload.'
    })
  }

  const parts = parseMultipart(raw, boundary)
  const filePart = parts.find(p => p.name === 'file' && p.data.length > 0)
  if (!filePart) {
    return json(res, 400, { error: 'Missing audio file field "file".' })
  }

  const mime = filePart.type || ''
  if (mime && !ALLOWED_AUDIO_TYPES.has(mime)) {
    return json(res, 415, { error: 'Unsupported audio format. Use WebM, MP4, WAV, MP3, or OGG.' })
  }

  const size = filePart.data.length
  if (!size || size > MAX_AUDIO_BYTES) {
    return json(res, 413, { error: 'Audio file is empty or exceeds the 20MB limit.' })
  }

  // Language hint is allowlisted; anything else falls through to auto-detect.
  const languagePart = parts.find(p => p.name === 'language')
  const rawLanguage = languagePart?.data.toString('utf8') || ''
  const language = ['en', 'ur'].includes(rawLanguage) ? rawLanguage : undefined

  // Groq infers the audio type from the file extension, so it must be present.
  const EXT_BY_MIME: Record<string, string> = {
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg'
  }
  const ext = EXT_BY_MIME[mime] || 'webm'

  try {
    const upstreamForm = new FormData()
    upstreamForm.append('file', new Blob([filePart.data], { type: mime || 'audio/webm' }), `voice_recording.${ext}`)
    upstreamForm.append('model', 'whisper-large-v3')
    upstreamForm.append('prompt', WHISPER_PROMPT)
    upstreamForm.append('response_format', 'json')
    if (language) {
      upstreamForm.append('language', language)
    }

    const upstream = await fetch(GROQ_STT_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: upstreamForm
    })

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => null)
      const upstreamMessage = err?.error?.message
      return json(res, upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status, {
        error: upstreamMessage
          ? `Transcription failed: ${upstreamMessage}`
          : `Transcription failed (HTTP ${upstream.status}).`
      })
    }

    const data = await upstream.json()
    return json(res, 200, { text: (data?.text || '').trim() })
  } catch (e: any) {
    return json(res, 502, { error: 'Could not reach the Groq transcription service. Try again.' })
  }
}
