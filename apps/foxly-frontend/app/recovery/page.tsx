"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, Button, TextInput } from "@/components/ui";
import { api } from "@/lib/api";

export default function Recovery() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"enter" | "verifying" | "new-codes" | "error">("enter");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setBusy(true);
    setStep("verifying");
    try {
      // Step 1: verify the used recovery code → limited-scope session cookie
      await api("/auth/recovery/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      // Step 2: complete recovery → full-scope JWT + fresh set of 10 recovery codes
      const result = await api<{ codes: string[] }>("/auth/recovery/complete", {
        method: "POST",
      });
      setNewCodes(result.codes);
      setStep("new-codes");
    } catch (err) {
      const msg = (err as Error).message;
      setErrorMsg(
        msg.includes("invalid") || msg.includes("used")
          ? "That code is invalid or has already been used. Try another code."
          : msg.includes("user not found")
          ? "No account found for this email."
          : msg
      );
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  // ── New codes screen ─────────────────────────────────────────────────────────
  if (step === "new-codes") {
    return (
      <AuthShell eyebrow="Account recovery">
        <h1 className="font-display text-4xl font-bold leading-tight">Save your new recovery codes</h1>
        <p className="mt-3 text-on-surface-variant">
          Your old codes are now invalid. These <strong>3 new codes</strong> are shown only once —
          store them somewhere safe before continuing.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 rounded-md bg-surface-container p-4 font-mono text-sm">
          {newCodes.map((c) => (
            <div key={c} className="rounded bg-white px-2 py-1 text-center shadow-sm select-all">
              {c}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          ⚠️ Once you leave this page these codes <strong>cannot be shown again</strong>.
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={savedConfirmed}
            onChange={(e) => setSavedConfirmed(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          I've saved all 3 codes in a safe place
        </label>

        <Button disabled={!savedConfirmed} onClick={() => router.push("/dashboard")}>
          Continue to dashboard
        </Button>
      </AuthShell>
    );
  }

  // ── Enter code screen ────────────────────────────────────────────────────────
  return (
    <AuthShell eyebrow="Account recovery">
      <h1 className="font-display text-4xl font-bold leading-tight">Sign in with a recovery code</h1>
      <p className="mt-3 text-on-surface-variant">
        Enter your email and one of the backup codes you saved during sign-up.
      </p>

      <form onSubmit={submit} className="mt-6">
        <label className="text-sm font-semibold">
          Email
          <TextInput
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold">
          Recovery code
          <TextInput
            required
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            placeholder="xxxxxxxx-xxxx"
            className="font-mono tracking-widest"
          />
        </label>

        {step === "error" && errorMsg && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-error">
            {errorMsg}
          </div>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? "Verifying…" : "Verify & sign in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-on-surface-variant">
        Remember your passkey?{" "}
        <a href="/sign-in" className="font-semibold text-primary">
          Sign in
        </a>
      </p>
    </AuthShell>
  );
}


