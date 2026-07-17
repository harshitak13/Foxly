"use client";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, TextInput } from "@/components/ui";
import { api, stableClientId } from "@/lib/api";
function friendlyError(msg: string): string {
  if (msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("not allowed"))
    return "Passkey prompt was dismissed or timed out. Please try again.";
  if (msg.includes("user not found"))
    return "No account found for this email. Please sign up first.";
  return msg;
}

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const options = await api<any>("/auth/signin/init", { method: "POST", body: JSON.stringify({ email }) });
      const assertion = await startAuthentication(options);
      const result = await api<any>("/auth/signin/verify", { method: "POST", body: JSON.stringify({ email, assertion, stableClientId: stableClientId() }) });
      if (result.stepUp) {
        sessionStorage.setItem("foxly_step_up", JSON.stringify(result));
        router.push("/verification-step-up");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Secure access">
      <h1 className="font-display text-4xl font-bold">Sign in with your passkey</h1>
      <p className="mt-3 text-on-surface-variant">Foxly checks your device, passkey, and risk signals before opening the dashboard.</p>
      <form onSubmit={submit} className="mt-6">
        <label className="text-sm font-semibold">
          Email
          <TextInput required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-error">{error}</p>
            <button type="submit" className="mt-2 text-sm font-semibold text-primary underline underline-offset-2">
              Try again
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 h-12 w-full rounded bg-primary text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Waiting for passkey…" : "Continue with passkey"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-on-surface-variant">
        Can't use your passkey?{" "}
        <a href="/recovery" className="font-semibold text-primary">
          Use a recovery code
        </a>
      </p>
    </AuthShell>
  );
}
