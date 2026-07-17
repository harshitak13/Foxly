"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, Button } from "@/components/ui";
import { api } from "@/lib/api";

export default function BackupCodes() {
  const router = useRouter();
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    try {
      const email = sessionStorage.getItem("foxly_email");
      const data = await api<{ codes: string[] }>("/auth/signup/backup-codes", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setCodes(data.codes);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AuthShell navLabel="Sign in" navHref="/sign-in">
      <h1 className="font-display text-4xl font-bold leading-tight">Save your recovery codes</h1>
      <p className="mt-3 text-on-surface-variant">
        These one-time codes are shown <strong>once</strong>. Store them somewhere safe — you can use
        them to sign in if you ever lose access to your passkey.
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

          <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            💡 You can use any of these 3 codes at <strong>/recovery</strong> to sign in if you lose your passkey.
          </div>

          <label className="mt-5 flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            I've saved these codes in a safe place
          </label>

          <Button disabled={!saved} onClick={() => router.push("/sign-up/success")}>
            Continue to dashboard
          </Button>
        </>
      )}

      {error && <p className="mt-4 text-sm text-error">{error}</p>}
    </AuthShell>
  );
}

