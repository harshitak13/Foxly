"use client";
import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, Button } from "@/components/ui";
import { api, stableClientId } from "@/lib/api";
export default function PasskeySetup() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const email = sessionStorage.getItem("foxly_email");
      const options = await api<any>("/auth/signup/passkey/options", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const attestation = await startRegistration(options);
      await api("/auth/signup/passkey/verify", {
        method: "POST",
        body: JSON.stringify({
          email,
          attestation,
          stableClientId: stableClientId(),
          deviceLabel: "Primary passkey",
        }),
      });
      router.push("/sign-up/backup-codes");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell navLabel="Sign in" navHref="/sign-in">
      <h1 className="font-display text-4xl font-bold">Set up your passkey</h1>
      <p className="mt-3 text-on-surface-variant">
        Use your device lock, fingerprint, or face unlock. Foxly never stores your private key.
      </p>
      <div className="mt-6 rounded-md bg-surface-container p-4 text-sm text-on-surface-variant">
        This step uses WebAuthn in the browser and verifies the attestation on the backend.
      </div>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <Button disabled={busy} onClick={enroll}>
        {busy ? "Waiting for passkey..." : "Create passkey"}
      </Button>
    </AuthShell>
  );
}


