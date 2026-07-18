"use client";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthShell, TextInput } from "@/components/ui";
import { api, stableClientId } from "@/lib/api";

type LinkStatus = "pending" | "scanned" | "completed" | "expired";
interface AuthLinkSession { sessionId: string; url: string; status: LinkStatus; expiresAt: string; }

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
  const [fallback, setFallback] = useState<AuthLinkSession | null>(null);
  const [fallbackStatus, setFallbackStatus] = useState<LinkStatus>("pending");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const options = await api<any>("/auth/signin/init", { method: "POST", body: JSON.stringify({ email }) });
      options.hints = ["hybrid", "client-device"];
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

  async function createFallback() {
    setError("");
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<AuthLinkSession>("/api/auth-link/create", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setFallback(data);
      setFallbackStatus(data.status);
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!fallback || fallbackStatus === "completed" || fallbackStatus === "expired") return;
    const interval = window.setInterval(async () => {
      try {
        const data = await api<{ status: LinkStatus }>(`/api/auth-link/${fallback.sessionId}/status`);
        setFallbackStatus(data.status);
        if (data.status === "completed") router.push("/dashboard");
      } catch (err) {
        setError((err as Error).message);
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [fallback, fallbackStatus, router]);

  const fallbackQrSrc = useMemo(() => {
    if (!fallback) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(fallback.url)}`;
  }, [fallback]);

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
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 h-12 w-full rounded bg-primary text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Waiting for passkey..." : "Continue with passkey"}
        </button>
      </form>

      <div className="mt-5 rounded-md border border-outline-variant bg-surface-container-low p-4">
        <p className="text-sm font-semibold text-on-surface">Use another registered device</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          First try your browser's built-in passkey option; it may show "use a different device" with native QR and proximity checks. Use this fallback only if that option is unavailable.
        </p>
        {fallback ? (
          <>
            {fallbackStatus !== "completed" && (
              <div className="mt-4 grid place-items-center rounded bg-white p-4">
                <img src={fallbackQrSrc} alt="QR code for second-device sign-in" width={240} height={240} className="h-60 w-60" />
              </div>
            )}
            <p className="mt-3 text-sm font-semibold">
              {fallbackStatus === "completed"
                ? "Sign-in complete."
                : fallbackStatus === "scanned"
                  ? "Device connected. Complete passkey sign-in there."
                  : fallbackStatus === "expired"
                    ? "QR expired. Generate a new one."
                    : "Waiting for scan..."}
            </p>
            {fallbackStatus === "expired" && (
              <button type="button" onClick={createFallback} className="mt-2 text-sm font-semibold text-primary underline underline-offset-2">
                Refresh QR code
              </button>
            )}
          </>
        ) : (
          <button type="button" onClick={createFallback} disabled={busy} className="mt-3 text-sm font-semibold text-primary underline underline-offset-2 disabled:opacity-50">
            Show fallback QR
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-on-surface-variant">
        Can't use any passkey?{" "}
        <a href="/recovery" className="font-semibold text-primary">
          Use a recovery code
        </a>
      </p>
    </AuthShell>
  );
}
