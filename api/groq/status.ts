/**
 * SERVER-SIDE GROQ STATUS PROBE
 *
 * Replaces the old direct api.groq.com/models ping that required the key in
 * the browser. Verifies the server holds a working key and reports model
 * availability — without ever returning the key itself.
 */

const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models'

function json(res: any, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed.' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !apiKey.trim()) {
    return json(res, 503, {
      success: false,
      configured: false,
      message: 'GROQ_API_KEY is not set on this deployment. Add it in Vercel project settings.'
    })
  }

  try {
    const started = Date.now()
    const upstream = await fetch(GROQ_MODELS_URL, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    const latencyMs = Date.now() - started

    if (!upstream.ok) {
      return json(res, 502, {
        success: false,
        configured: true,
        message: `Server key rejected by Groq (HTTP ${upstream.status}). Verify the GROQ_API_KEY value.`
      })
    }

    const data = await upstream.json()
    const availableModels: string[] = (data?.data || []).map((m: any) => m.id).filter((id: any) => typeof id === 'string')
    const hasLlama33 = availableModels.some(m => m.includes('llama-3.3') || m.includes('llama3'))

    return json(res, 200, {
      success: true,
      configured: true,
      model: hasLlama33 ? 'llama-3.3-70b-versatile' : availableModels[0] || 'llama3-8b-8192',
      modelCount: availableModels.length,
      latencyMs,
      message: `Connected via server proxy (${availableModels.length} models active). Key never leaves the server.`
    })
  } catch {
    return json(res, 502, {
      success: false,
      configured: true,
      message: 'Could not reach the Groq service from the server. Try again.'
    })
  }
}
