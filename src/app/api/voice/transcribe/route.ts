import { NextRequest } from "next/server";
import { getGroqClient, isProviderError, GroqConfigError } from "@/lib/ai/groq/client";
import { MODELS } from "@/lib/ai/model-config";
import { fail, ok } from "@/lib/responses";

/**
 * POST /api/voice/transcribe — PRD §9 voice-first pipeline, step 1.
 * multipart/form-data: { audio: File } → Whisper transcription.
 * The transcript is returned to the client for preview/editing BEFORE it is
 * sent to /api/chat — the user can correct Whisper, then the same validated
 * tool pipeline runs (voice is just another input method, Principle 4).
 * Keys stay server-side (PRD §19); errors never expose stack traces (§29).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Groq free-tier limit

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(fail("transcribe", "VALIDATION_ERROR", "Expected multipart/form-data with an 'audio' file"), { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json(fail("transcribe", "VALIDATION_ERROR", "Field 'audio' (webm/ogg/wav/mp3) is required"), { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json(fail("transcribe", "VALIDATION_ERROR", "Audio too large (max 25MB)"), { status: 413 });
  }

  try {
    const groq = getGroqClient();
    const translation = form.get("mode") === "translate";
    const result = await (translation
      ? groq.audio.transcriptions.create({ file: audio, model: MODELS.whisper, response_format: "verbose_json" })
      : groq.audio.transcriptions.create({ file: audio, model: MODELS.whisper, response_format: "verbose_json" }));

    const r = result as { text?: string; language?: string; duration?: number };
    const text = (r.text ?? "").trim();
    if (!text) {
      return Response.json(fail("transcribe", "VALIDATION_ERROR", "No speech detected in the recording"), { status: 422 });
    }
    return Response.json(
      ok("transcribe", {
        transcript: text,
        language: r.language ?? null,
        duration_seconds: r.duration ?? null,
        note: "Edit the transcript if needed before sending — it runs through the same validated pipeline as typed text.",
      })
    );
  } catch (err) {
    if (err instanceof GroqConfigError) {
      return Response.json(fail("transcribe", "AI_PROVIDER_ERROR", "Voice service is not configured (missing GROQ_API_KEY)"), { status: 503 });
    }
    const provider = isProviderError(err);
    console.error("[voice] transcription failed:", err instanceof Error ? err.message : err);
    return Response.json(
      fail("transcribe", provider ? "RATE_LIMITED" : "AI_PROVIDER_ERROR", provider ? "⚠️ Voice service is busy — try again in a moment." : "⚠️ Transcription failed. You can type your message instead."),
      { status: 502 }
    );
  }
}
