/**
 * Groq Cloud AI Client
 * Provides direct API integration for:
 * 1. Llama-3.3-70b / Llama-3-8b Chat Completions & Agent Supervisor
 * 2. Whisper-large-v3 Speech-to-Text for Voice Assistant (Urdu & English)
 * 3. Browser Speech Synthesis for Real Voice Audio Feedback
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

/**
 * Returns effective Groq API key checking explicit parameter, localStorage, or environment
 */
export function getEffectiveGroqApiKey(explicitKey?: string): string {
  if (explicitKey && explicitKey.trim()) return explicitKey.trim();
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('copilot_groq_key');
    if (saved && saved.trim()) return saved.trim();
  }
  const envKey = (typeof process !== 'undefined' && process.env?.GROQ_API_KEY) || '';
  return envKey.trim();
}

/**
 * Validates the Groq API key by sending a minimalist ping to Groq's models endpoint
 */
export async function testGroqConnection(apiKey?: string): Promise<GroqTestResult> {
  const cleanKey = getEffectiveGroqApiKey(apiKey);
  if (!cleanKey) {
    return { success: false, message: 'Please provide a valid Groq API key (starts with gsk_)' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json'
      }
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        message: err.error?.message || `Groq authentication failed (HTTP ${response.status})`,
        latencyMs
      };
    }

    const data = await response.json();
    const availableModels = data.data?.map((m: any) => m.id) || [];
    const hasLlama33 = availableModels.some((m: string) => m.includes('llama-3.3') || m.includes('llama3'));

    return {
      success: true,
      model: hasLlama33 ? 'llama-3.3-70b-versatile' : (availableModels[0] || 'llama3-8b-8192'),
      message: `Successfully connected to Groq API (${availableModels.length} models active)`,
      latencyMs
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Network error connecting to api.groq.com'
    };
  }
}

/**
 * Executes a chat completion via Groq Cloud (Llama 3.3 70B)
 */
export async function queryGroqChat(
  messages: GroqChatMessage[],
  apiKey?: string,
  model: string = 'llama-3.3-70b-versatile',
  systemPrompt?: string
): Promise<string> {
  const cleanKey = getEffectiveGroqApiKey(apiKey);
  if (!cleanKey) {
    throw new Error('Groq API key not configured. Add it in Settings or .env');
  }

  const formattedMessages: GroqChatMessage[] = [];
  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }
  formattedMessages.push(...messages);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      messages: formattedMessages,
      temperature: 0.1,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Groq API error (Status ${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated from Groq.';
}

/**
 * Transcribes real audio blob using Groq Whisper large v3 (Multilingual Urdu & English)
 */
export async function transcribeWithGroqWhisper(
  audioBlob: Blob,
  apiKey?: string,
  language: string = 'both'
): Promise<string> {
  const cleanKey = getEffectiveGroqApiKey(apiKey);
  if (!cleanKey) {
    throw new Error('Groq API key required for Whisper voice transcription.');
  }

  const extension = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
  const formData = new FormData();
  formData.append('file', audioBlob, `voice_recording.${extension}`);
  formData.append('model', 'whisper-large-v3');
  formData.append('prompt', 'Pakistani industrial manufacturing ERP, cotton yarn, reactive dye, purchase order, sales invoice, 18% GST, FBR compliance, Urdu Roman and English commands');
  
  if (language && language !== 'both' && language !== 'auto') {
    formData.append('language', language);
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq Whisper transcription failed (HTTP ${response.status})`);
  }

  const data = await response.json();
  return (data.text || '').trim();
}

/**
 * Speaks text using Web SpeechSynthesis API with clean text sanitization
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
