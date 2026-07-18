"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AuthShell, Button, TextInput } from "@/components/ui";
import { api, stableClientId } from "@/lib/api";

interface OptionsResponse {
  account: { email: string; name: string };
  options: unknown;
}

export default function DeviceLinkPage() {
  const params = useParams<{ id: string }>();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/device-link/${params.id}/email-code`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setCodeSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const proof = { email, code };
      const data = await api<OptionsResponse>(`/api/device-link/${params.id}/options`, {
        method: "POST",
        body: JSON.stringify(proof),
      });
      setAccountEmail(data.account.email);
      const attestation = await startRegistration(data.options as any);
      await api(`/api/device-link/${params.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          ...proof,
          attestation,
          stableClientId: stableClientId(),
          deviceLabel: deviceLabel || "Backup passkey device",
        }),
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Backup device" navLabel="Sign in" navHref="/sign-in">
      {done ? (
        <>
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-700">
            <ShieldCheck size={24} />
          </div>
          <h1 className="font-display text-3xl font-bold">Backup device registered</h1>
          <p className="mt-3 text-on-surface-variant">This device can now sign in to Foxly with its passkey.</p>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-bold">Add this sign-in device</h1>
          <p className="mt-3 text-on-surface-variant">
            You are adding a new sign-in device to account: <strong>{accountEmail || email || "confirm below"}</strong>.
            If you did not initiate this, close this page.
          </p>

          {!codeSent ? (
            <form onSubmit={sendCode} className="mt-6">
              <label className="text-sm font-semibold">
                Account email
                <TextInput required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <Button disabled={busy}>{busy ? "Sending code..." : "Send one-time code"}</Button>
            </form>
          ) : (
            <form onSubmit={register} className="mt-6 space-y-4">
              <label className="text-sm font-semibold">
                One-time email code
                <TextInput required inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <label className="text-sm font-semibold">
                Device name
                <TextInput value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} placeholder="Rahul's iPhone" />
              </label>
              <Button disabled={busy}>{busy ? "Registering..." : "Register passkey on this device"}</Button>
            </form>
          )}

          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </>
      )}
    </AuthShell>
  );
}
