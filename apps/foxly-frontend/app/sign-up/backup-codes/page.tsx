"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, Button } from "@/components/ui";
import { api } from "@/lib/api";

declare global {
  interface Window {
    PasswordCredential?: new (data: { id: string; name?: string; password: string }) => Credential;
  }
}

export default function BackupCodes() {
  const router = useRouter();
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const generatedAt = new Date().toISOString();

  async function generate() {
    try {
      const email = sessionStorage.getItem("foxly_email");
      const data = await api<{ codes: string[] }>("/auth/signup/backup-codes", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setCodes(data.codes);

      // Auto-save to Password Manager
      try {
        if ("credentials" in navigator && window.PasswordCredential) {
          const cred = new window.PasswordCredential({
            id: email || "foxly-account",
            name: "Foxly backup codes",
            password: data.codes.join(" "),
          });
          await navigator.credentials.store(cred);
          setSaved(true);
        }
      } catch {}
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function csvBody() {
    return ["code,used,generated_at", ...codes.map((code) => `${code},false,${generatedAt}`)].join("\n");
  }

  function downloadCsv() {
    const blob = new Blob([csvBody()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "foxly-backup-codes.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveToPasswordManager() {
    const email = sessionStorage.getItem("foxly_email") ?? "foxly-account";
    try {
      if (!("credentials" in navigator) || !window.PasswordCredential) {
        downloadCsv();
        return;
      }
      const credential = new window.PasswordCredential({
        id: email,
        name: "Foxly backup codes",
        password: codes.join(" "),
      });
      await navigator.credentials.store(credential);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
      downloadCsv();
    }
  }

  return (
    <AuthShell navLabel="Sign in" navHref="/sign-in">
      <h1 className="font-display text-4xl font-bold leading-tight">Save your recovery codes</h1>
      <p className="mt-3 text-on-surface-variant">
        These one-time codes are shown <strong>once</strong>. Store them somewhere safe so you can recover access if every passkey device is unavailable.
      </p>

      {codes.length === 0 ? (
        <Button onClick={generate}>Generate recovery codes</Button>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 rounded-md bg-surface-container p-4 font-mono text-sm">
            {codes.map((c) => (
              <div key={c} className="rounded bg-white px-2 py-1 text-center shadow-sm">
                {c}
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Don't store these in chat apps or unencrypted notes. Use a password manager or print and store them physically.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={saveToPasswordManager} className="h-11 rounded bg-primary text-sm font-semibold text-white">
              Save to Password Manager
            </button>
            <button onClick={downloadCsv} className="h-11 rounded border border-outline-variant bg-white text-sm font-semibold text-primary">
              Download CSV
            </button>
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            I've saved these codes in a safe place
          </label>

          <Button disabled={!saved} onClick={() => router.push("/sign-up/success")}>
            Continue
          </Button>
        </>
      )}

      {error && <p className="mt-4 text-sm text-error">{error}</p>}
    </AuthShell>
  );
}
