"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { api, stableClientId } from "@/lib/api";
import { useDevices } from "@/lib/use-devices";
import { DeviceLinkInvite } from "@/components/device-link-invite";

export default function AddDevice() {
  const router = useRouter();
  const { refresh } = useDevices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /** Register a passkey on the device the user is currently on */
  async function registerHere() {
    setBusy(true);
    setError("");
    try {
      const options = await api<any>("/auth/device/options", { method: "POST" });
      const attestation = await startRegistration(options);
      await api("/auth/device/verify", {
        method: "POST",
        body: JSON.stringify({
          attestation,
          stableClientId: stableClientId(),
          deviceLabel: "Additional passkey",
        }),
      });
      setDone(true);
      refresh(); // update device list on /devices immediately
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.includes("timed out") || msg.includes("not allowed")
          ? "Passkey prompt dismissed or timed out — please try again."
          : msg
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/devices")}
          className="text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Back"
        >
          ←
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface">Add a Device</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Scan the QR on another device, or register a passkey right here.
          </p>
        </div>
      </div>

      {/* ── QR / cross-device flow (same as sign-up success page) ── */}
      <DeviceLinkInvite />

      {/* ── Divider ── */}
      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 border-t border-outline-variant" />
        <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
          or register on this device
        </span>
        <div className="flex-1 border-t border-outline-variant" />
      </div>

      {/* ── This-device passkey flow ── */}
      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-orange-100 text-2xl shrink-0">
            🔑
          </div>
          <div>
            <p className="font-bold text-on-surface">Register on this device</p>
            <p className="text-sm text-on-surface-variant">
              Use your device's biometrics or security key to add a passkey right now.
            </p>
          </div>
        </div>

        {done ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            ✅ Passkey registered on this device.
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-error">
                {error}
              </div>
            )}
            <button
              onClick={registerHere}
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? "Waiting for passkey…" : "Create passkey on this device"}
            </button>
          </>
        )}
      </div>

      {/* Back link */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => router.push("/devices")}
          className="text-sm text-on-surface-variant hover:text-on-surface underline underline-offset-2"
        >
          Back to devices
        </button>
      </div>
    </div>
  );
}
