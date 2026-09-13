/**
 * Groq Cloud AI Client — server-proxied (PRD §40 Security Checklist)
 *
 * "Groq key is server-side": this module talks ONLY to same-origin /api/groq/*
 * serverless functions. The API key lives exclusively in server environment
 * variables and is never present in the browser bundle, localStorage, or
 * network payloads the client controls.
 *
 * 1. /api/groq/chat       — Llama-3.3-70b chat completions (Agent Supervisor)
 * 2. /api/groq/transcribe — Whisper-large-v3 STT (Urdu & English voice)
 * 3. /api/groq/status     — server-side connection health probe
 * 4. speakVoiceResponse   — browser SpeechSynthesis (no network, no key)
 */

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqTestResult {
  success: boolean;
  model?: string;
  message: string;
  latencyMs?: number;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body?.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Health check via the server proxy. Returns success only when the
 * deployment's server-side key is configured and accepted by Groq.
 */
export async function testGroqConnection(): Promise<GroqTestResult> {
  try {
    const response = await fetch('/api/groq/status', { method: 'GET' });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: body?.error || body?.message || `AI status check failed (HTTP ${response.status})`
      };
    }

    return {
      success: !!body?.success,
      model: body?.model,
      message: body?.message || (body?.success ? 'Connected via server proxy.' : 'AI service unavailable.'),
      latencyMs: body?.latencyMs
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Network error reaching the AI proxy.'
    };
  }
}

/**
 * Executes a chat completion through the server proxy (Llama 3.3 70B).
 */
export async function queryGroqChat(
  messages: GroqChatMessage[],
  model: string = 'llama-3.3-70b-versatile',
  systemPrompt?: string
): Promise<string> {
  const formattedMessages: GroqChatMessage[] = [];
  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }
  formattedMessages.push(...messages);

  const response = await fetch('/api/groq/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      messages: formattedMessages
    })
  });

  if (!response.ok) {
    throw new Error(await readError(response, `AI request failed (HTTP ${response.status}).`));
  }

  const data = await response.json();
  return data?.content || 'No response generated from Groq.';
}

/**
 * Transcribes a recorded audio blob via the server proxy (Whisper large v3,
 * multilingual Urdu & English). Language hint is optional; 'both'/'auto'
 * defers to upstream auto-detection.
 */
export async function transcribeWithGroqWhisper(
  audioBlob: Blob,
  language: string = 'both'
): Promise<string> {
  const extension = audioBlob.type.includes('mp4')
    ? 'mp4'
    : audioBlob.type.includes('wav')
      ? 'wav'
      : 'webm';

  const formData = new FormData();
  formData.append('file', audioBlob, `voice_recording.${extension}`);
  if (language && language !== 'both' && language !== 'auto') {
    formData.append('language', language);
  }

  const response = await fetch('/api/groq/transcribe', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Voice transcription failed (HTTP ${response.status}).`));
  }

  const data = await response.json();
  return (data?.text || '').trim();
}

/**
 * Speaks text using Web SpeechSynthesis API with clean text sanitization.
 * Entirely local to the browser — no network, no key, no proxy involved.
 */
export function speakVoiceResponse(rawText: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    window.speechSynthesis.cancel(); // Stop prior playback

    // Clean markdown characters like asterisks, hashes, backticks
    const clean = rawText
      .replace(/[*_#`~[\]]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\n+/g, '. ')
      .trim();

    if (!clean) return;

    // Take up to first 250 characters for clean spoken executive summary
    const truncated = clean.length > 250 ? clean.substring(0, 240) + '.' : clean;

    const utterance = new SpeechSynthesisUtterance(truncated);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    // Prefer English/Indian or natural voice
    const naturalVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en-GB') || v.lang.includes('en-US'));
    if (naturalVoice) utterance.voice = naturalVoice;

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
    if (onEnd) onEnd();
  }
}
