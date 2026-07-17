"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, Button, TextInput } from "@/components/ui";
import { api, stableClientId } from "@/lib/api";
import { startRegistration } from "@simplewebauthn/browser";

export default function AddDevice() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("Laptop");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      // Step 1: fetch options for logged-in user
      const options = await api<any>("/auth/device/options", { method: "POST" });
      
      // Step 2: request WebAuthn browser attestation
      const attestation = await startRegistration(options);
      
      // Step 3: verify with backend and save
      const deviceLabel = `${platform} (${name})`;
      await api("/auth/device/verify", {
        method: "POST",
        body: JSON.stringify({
          attestation,
          stableClientId: stableClientId(),
          deviceLabel: deviceLabel
        })
      });

      // Redirect back to devices on success
      router.push("/devices");
    } catch (err) {
      setError(
        (err as Error).message.includes("timed out") || (err as Error).message.includes("not allowed")
          ? "Passkey registration prompt dismissed or timed out. Please try again."
          : (err as Error).message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-on-surface">Add Trusted Device</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Register a new hardware device, security key, or client browser by enrolling a passkey.
        </p>
      </div>

      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-on-surface">Device name</label>
            <TextInput
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Personal MacBook Pro, Work Phone"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-on-surface">Platform / Type</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="mt-2 h-12 w-full rounded border border-outline-variant bg-surface-container-low px-4 text-on-surface outline-none focus:border-primary"
            >
              <option value="Laptop">💻 Laptop</option>
              <option value="Mobile">📱 Mobile / Phone</option>
              <option value="Desktop">🖥️ Desktop</option>
              <option value="Security Key">🔑 Security Key (YubiKey)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-on-surface">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Registered in the office, used for recovery fallback."
              rows={3}
              className="mt-2 w-full rounded border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary text-sm"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.push("/devices")}
              className="rounded-lg border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <Button type="submit" disabled={busy} className="mt-0 w-auto px-6">
              {busy ? "Registering passkey..." : "Enlist Device"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
