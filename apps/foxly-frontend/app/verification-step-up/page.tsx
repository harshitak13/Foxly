"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/ui";
import { api, stableClientId } from "@/lib/api";

declare global {
  interface Window {
    PasswordCredential?: new (data: { id: string; name?: string; password: string }) => Credential;
  }
}

interface RiskInfo { score: number; reasons: string[]; policy: string; }
interface StepUpData {
  stepUp: "backup_code_required" | "push_approval_required" | "blocked";
  risk: RiskInfo;
  email: string;
  approval?: { id: string };
}

export default function StepUp() {
  const router = useRouter();
  const [data, setData] = useState<StepUpData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generatedAt = new Date().toISOString();

  useEffect(() => {
    const raw = sessionStorage.getItem("foxly_step_up");
    if (!raw) { router.replace("/sign-in"); return; }
    const parsed: StepUpData = JSON.parse(raw);
    setData(parsed);

    // Start polling approval status if this is a push-approval step-up
    if (parsed.stepUp === "push_approval_required" && parsed.approval?.id) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await api<{ approvals: { id: string; status: string }[] }>(
            `/approvals?status=approved`
          );
          const found = res.approvals?.find((a) => a.id === parsed.approval!.id);
          if (found) {
            clearInterval(pollRef.current!);
            setApprovalStatus("approved");
            sessionStorage.removeItem("foxly_step_up");
            router.push("/dashboard");
          }
        } catch {/* ignore poll errors */}
      }, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [router]);

  async function submitBackupCode(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setError("");
    setBusy(true);
    try {
      await api("/auth/recovery/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: data.email, code: code.trim().toUpperCase(), stableClientId: stableClientId() }),
      });
      // Complete recovery → get fresh backup codes
      const result = await api<{ codes: string[] }>("/auth/recovery/complete", { method: "POST" });
      sessionStorage.removeItem("foxly_step_up");
      setNewCodes(result.codes);

      // Auto-save to Password Manager
      try {
        if ("credentials" in navigator && window.PasswordCredential) {
          const cred = new window.PasswordCredential({
            id: data.email || "foxly-account",
            name: "Foxly backup codes",
            password: result.codes.join(" "),
          });
          await navigator.credentials.store(cred);
          setSavedConfirmed(true);
        }
      } catch {}
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── Save helpers ───────────────────────────────────────────────────────────────
  function downloadCsv() {
    const rows = ["code,used,generated_at", ...newCodes.map((c) => `${c},false,${generatedAt}`)].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "foxly-backup-codes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveToPasswordManager() {
    if (!data) return;
    try {
      if (!("credentials" in navigator) || !window.PasswordCredential) {
        downloadCsv();
        return;
      }
      const cred = new window.PasswordCredential({
        id: data.email || "foxly-account",
        name: "Foxly backup codes",
        password: newCodes.join(" "),
      });
      await navigator.credentials.store(cred);
      setSavedConfirmed(true);
    } catch {
      downloadCsv();
    }
  }

  if (!data) return null;

  const { stepUp, risk } = data;

  // ── New codes screen (shown after backup code verified) ────────────────────────
  if (newCodes.length > 0) {
    return (
      <AuthShell eyebrow="Account recovery">
        <h1 className="font-display text-4xl font-bold leading-tight">Save your new recovery codes</h1>
        <p className="mt-3 text-on-surface-variant">
          Your old codes are now invalid. These <strong>{newCodes.length} new codes</strong> are
          shown only once — store them somewhere safe before continuing.
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

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            id="save-password-manager"
            onClick={saveToPasswordManager}
            className="h-11 rounded bg-primary text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            💾 Save to Password Manager
          </button>
          <button
            id="download-csv"
            onClick={downloadCsv}
            className="h-11 rounded border border-outline-variant bg-white text-sm font-semibold text-primary hover:bg-surface-container transition-colors"
          >
            ⬇ Download CSV
          </button>
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={savedConfirmed}
            onChange={(e) => setSavedConfirmed(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          I've saved all {newCodes.length} codes in a safe place
        </label>

        <button
          disabled={!savedConfirmed}
          onClick={() => router.push("/dashboard")}
          className="mt-4 h-12 w-full rounded bg-primary text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to dashboard
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Step-up verification">
      <h1 className="font-display text-4xl font-bold">Extra confirmation required</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Risk score: <strong>{risk?.score ?? 0}</strong>
        {risk?.reasons?.length > 0 && (
          <> &mdash; {risk.reasons.join(", ")}</>
        )}
      </p>

      {/* ── Backup code step-up ── */}
      {stepUp === "backup_code_required" && (
        <form onSubmit={submitBackupCode} className="mt-6 space-y-4">
          <p className="text-on-surface-variant text-sm">
            This sign-in looks unusual. Enter one of your saved backup codes to continue.
          </p>
          <input
            id="backup-code-input"
            className="h-12 w-full rounded border border-outline-variant bg-surface-container-low px-4 font-mono text-sm uppercase tracking-widest"
            placeholder="ABCDE-23456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
          />
          {error && (
            <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}
          <button
            id="submit-backup-code"
            type="submit"
            disabled={busy || !code.trim()}
            className="h-12 w-full rounded bg-primary text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Verifying…" : "Verify backup code"}
          </button>
          <a href="/recovery" className="block text-center text-sm text-primary underline underline-offset-2">
            Lost your backup codes? Go to full recovery
          </a>
        </form>
      )}

      {/* ── Push approval step-up ── */}
      {stepUp === "push_approval_required" && (
        <div className="mt-6 space-y-4">
          <p className="text-on-surface-variant text-sm">
            A push-approval request has been sent to your other trusted Foxly sessions.
            Sign in on a trusted device and approve the request to continue here.
          </p>
          <div className="flex items-center gap-3 rounded-md border border-outline-variant bg-surface-container-low p-4">
            <span className="animate-spin text-xl">⏳</span>
            <span className="text-sm font-semibold">
              {approvalStatus === "approved" ? "Approved! Redirecting…" : "Waiting for approval…"}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Open Foxly on your trusted device, go to <strong>Approvals</strong>, and tap{" "}
            <strong>Approve</strong>.
          </p>
        </div>
      )}

      {/* ── Blocked ── */}
      {stepUp === "blocked" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-error">Sign-in blocked</p>
            <p className="mt-1 text-sm text-error">
              This sign-in was flagged as high-risk and blocked. A security event has been logged.
              If this was you, use a backup code or contact support.
            </p>
          </div>
          <a href="/recovery" className="block text-center text-sm text-primary underline underline-offset-2">
            Use a recovery code instead
          </a>
          <a href="/sign-in" className="block text-center text-sm text-on-surface-variant underline underline-offset-2">
            Back to sign in
          </a>
        </div>
      )}
    </AuthShell>
  );
}
