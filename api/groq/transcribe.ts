/**
 * SERVER-SIDE GROQ WHISPER PROXY (PRD §40 Security Checklist)
 *
 * Voice transcription endpoint: the browser uploads the audio Blob here and
 * this serverless function forwards it to Groq Whisper large-v3 with the
 * server-held key. The key never reaches the client.
 *
 * Hardening:
 * - POST-only, multipart/form-data
 * - 20MB hard cap (Groq free tier allows 25MB) enforced before forwarding
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

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return json(res, 400, { error: 'Request must be multipart/form-data with an audio file.' })
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return json(res, 400, { error: 'Missing audio file field "file".' })
  }

  const blob = file as File & { arrayBuffer(): Promise<ArrayBuffer> }

  const mime = (blob as any).type || ''
  if (mime && !ALLOWED_AUDIO_TYPES.has(mime)) {
    return json(res, 415, { error: 'Unsupported audio format. Use WebM, MP4, WAV, MP3, or OGG.' })
  }

  const size = (blob as any).size ?? 0
  if (!size || size > MAX_AUDIO_BYTES) {
    return json(res, 413, { error: 'Audio file is empty or exceeds the 20MB limit.' })
  }

  // Language hint is allowlisted; anything else falls through to auto-detect.
  const rawLanguage = formData.get('language')
  const language = typeof rawLanguage === 'string' && ['en', 'ur'].includes(rawLanguage) ? rawLanguage : undefined

  try {
    const audioBuffer = await blob.arrayBuffer()

    const upstreamForm = new FormData()
    upstreamForm.append('file', new Blob([audioBuffer], { type: mime || 'audio/webm' }), 'voice_recording')
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
