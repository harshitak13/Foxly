"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AuthShell, Button } from "@/components/ui";
import { api } from "@/lib/api";

interface OptionsResponse {
  account: { email: string; name: string };
  options: unknown;
}

export default function AuthLinkPage() {
  const params = useParams<{ id: string }>();
  const [accountEmail, setAccountEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function authenticate() {
    setBusy(true);
    setError("");
    try {
      const data = await api<OptionsResponse>(`/api/auth-link/${params.id}/options`, { method: "POST" });
      setAccountEmail(data.account.email);
      const assertion = await startAuthentication(data.options as any);
      await api(`/api/auth-link/${params.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ assertion }),
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Second device sign-in" navLabel="Sign in" navHref="/sign-in">
      {done ? (
        <>
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-700">
            <ShieldCheck size={24} />
          </div>
          <h1 className="font-display text-3xl font-bold">Sign-in approved</h1>
          <p className="mt-3 text-on-surface-variant">Return to the original browser tab to continue.</p>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-bold">Approve Foxly sign-in</h1>
          <p className="mt-3 text-on-surface-variant">
            This uses an already registered passkey{accountEmail ? ` for ${accountEmail}` : ""}. The session will open on the browser that showed the QR code.
          </p>
          <Button onClick={authenticate} disabled={busy}>{busy ? "Waiting for passkey..." : "Use this device's passkey"}</Button>
          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </>
      )}
    </AuthShell>
  );
}
