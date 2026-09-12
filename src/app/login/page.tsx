"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client-api";
import { btnPrimary, cardStyle, inputStyle, Field, ErrorNote } from "@/components/ui";

/**
 * /login — email/password auth (CONTRACTS §7). In dev-fallback mode (no Supabase
 * env on the server) the app is open and this page shows a notice instead.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("demo@copilot.pk");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        await apiSend("/api/auth/login", { email, password });
      } else {
        await apiSend("/api/auth/signup", {
          email,
          password,
          organization_name: orgName || "My Factory",
          full_name: email.split("@")[0],
        });
        // Signup auto-signs-in on most Supabase projects; if confirmation is
        // required the user lands here and signs in manually.
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ ...cardStyle, width: 380, maxWidth: "100%" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>AI Business Copilot</h1>
        <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 13 }}>
          {mode === "signin" ? "Sign in to your factory workspace" : "Create your factory workspace"}
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button type="button" onClick={() => setMode("signin")} style={{ ...tabStyle, ...(mode === "signin" ? tabActive : {}) }}>
            Sign in
          </button>
          <button type="button" onClick={() => setMode("signup")} style={{ ...tabStyle, ...(mode === "signup" ? tabActive : {}) }}>
            Sign up
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <Field label="Organization name">
              <input style={inputStyle} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Demo Textiles" />
            </Field>
          )}
          <Field label="Email">
            <input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
            <input style={inputStyle} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button type="submit" style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy}>
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}

const tabStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 0",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  fontWeight: 600,
  fontSize: 13,
};

const tabActive: React.CSSProperties = {
  background: "var(--panel-2)",
  color: "var(--text)",
};
