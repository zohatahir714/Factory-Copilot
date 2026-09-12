"use client";

import { useEffect, useRef, useState } from "react";

/**
 * VOICE INPUT (PRD §9) — mic button + MediaRecorder + editable transcript.
 * Flow: record → POST /api/voice/transcribe (Groq Whisper) → transcript shows
 * in an editable box → user reviews/edits → send() runs the EXACT same chat
 * pipeline as typed text. Recording failures fall back gracefully to typing.
 */

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function VoiceButton({ onSend, disabled }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing" | "preview">("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => stopEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopEverything = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  };

  const start = async () => {
    setError(null);
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Live level meter (visual feedback that the mic is hot).
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevel(data.reduce((a, b) => a + b, 0) / data.length / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = onRecordStop;
      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access denied or unavailable — you can type your message instead.");
      setState("idle");
    }
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    stopEverything();
  };

  const onRecordStop = async () => {
    setState("transcribing");
    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || "audio/webm" });
    if (blob.size < 2000) {
      setError("Recording was too short — hold the button and speak.");
      setState("idle");
      return;
    }
    try {
      const form = new FormData();
      form.append("audio", blob, "speech.webm");
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? "Transcription failed");
      }
      setTranscript(json.data.transcript as string);
      setState("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed — you can type instead.");
      setState("idle");
    }
  };

  const send = () => {
    const text = transcript.trim();
    reset();
    if (text) onSend(text);
  };

  const reset = () => {
    setState("idle");
    setTranscript("");
    setError(null);
    setLevel(0);
  };

  return (
    <div style={{ position: "relative" }}>
      {state === "idle" && (
        <button type="button" aria-label="Record voice message" onClick={start} disabled={disabled} style={{ ...micStyle, opacity: disabled ? 0.5 : 1 }}>
          🎙
        </button>
      )}

      {state === "recording" && (
        <button type="button" aria-label={`Stop recording (${seconds}s)`} onClick={stop} style={{ ...micStyle, background: "var(--err)", borderColor: "var(--err)" }}>
          <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 999, background: "#fff", transform: `scale(${1 + level * 0.8})` }} />
        </button>
      )}

      {state === "transcribing" && (
        <button type="button" disabled style={{ ...micStyle, opacity: 0.6 }} aria-label="Transcribing">
          ⏳
        </button>
      )}

      {state === "preview" && (
        <div style={previewStyle} role="dialog" aria-label="Edit transcript before sending">
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>🎙 Heard that — edit if needed, then send:</div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
            autoFocus
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={reset} style={ghostBtn}>Discard</button>
            <button type="button" onClick={send} disabled={!transcript.trim()} style={sendBtn}>Send ➤</button>
          </div>
        </div>
      )}

      {error && (
        <div style={errStyle} role="alert">
          {error}
          <button type="button" onClick={reset} aria-label="Dismiss" style={{ marginLeft: 8, color: "var(--muted)", background: "none", border: "none" }}>✕</button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- styles -------------------------------- */

const micStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--panel-2)",
  color: "var(--text)",
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const previewStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 56,
  right: 0,
  width: 420,
  maxWidth: "86vw",
  background: "var(--panel)",
  border: "1px solid var(--warn)",
  borderRadius: 12,
  padding: 12,
  zIndex: 60,
  boxShadow: "0 12px 32px rgba(0,0,0,.4)",
};

const ghostBtn: React.CSSProperties = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 8,
  padding: "6px 14px",
};

const sendBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "6px 14px",
  fontWeight: 600,
};

const errStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 56,
  right: 0,
  maxWidth: 340,
  background: "var(--panel)",
  border: "1px solid var(--err)",
  color: "var(--text)",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  zIndex: 60,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
  outline: "none",
};
