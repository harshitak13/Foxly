"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/ui";
import { DeviceLinkInvite } from "@/components/device-link-invite";
import type { Device } from "@/lib/use-devices";

interface DevicesResponse {
  devices: Device[];
  isCurrentDevicePrimary: boolean;
  currentDeviceCanRevoke: boolean;
  currentDeviceId: string | null;
}

export default function Success() {
  const router = useRouter();

  // null = loading, Device[] = loaded
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDevices = useCallback(async () => {
    setChecking(true);
    try {
      const data = await api<DevicesResponse>("/devices");
      setDevices(Array.isArray(data.devices) ? data.devices : []);
    } catch {
      // If API fails treat as empty list — button stays disabled
      setDevices((prev) => prev ?? []);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    // Poll every 3 s so the page reacts when the other device completes QR flow
    intervalRef.current = setInterval(loadDevices, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadDevices]);

  // Derived state — only computed once devices are loaded
  const primaryDevice = devices?.find((d) => d.isPrimary) ?? devices?.[0];
  const backupDevices =
    devices?.filter((d) => !d.isPrimary && d.id !== primaryDevice?.id) ?? [];

  const hasBackupDevice = backupDevices.length > 0;
  const hasRevokeGranted = backupDevices.some((d) => d.canRevoke);

  // Both requirements must be met AND we must have finished the initial load
  const canProceed = devices !== null && hasBackupDevice && hasRevokeGranted;

  async function grantRevoke(id: string) {
    try {
      await api(`/devices/${id}/grant-revoke`, { method: "POST" });
      await loadDevices();
    } catch { /* ignore */ }
  }

  function handleDeviceAdded() {
    loadDevices();
  }

  const step1Done = hasBackupDevice;
  const step2Done = hasRevokeGranted;

  return (
    <AuthShell>
      <h1 className="font-display text-4xl font-bold">You&apos;re protected</h1>
      <p className="mt-3 text-on-surface-variant">
        Your passkey and backup codes are ready. You must complete both steps below before you can open your dashboard.
      </p>

      {/* ── Step checklist ─────────────────────────────────────── */}
      <div className="mt-6 space-y-3">

        {/* Step 1 — backup device */}
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 transition-colors duration-300 ${
            step1Done
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {step1Done ? (
              <CheckCircle2 size={22} className="text-green-600" />
            ) : (
              <Circle size={22} className="text-amber-500" />
            )}
          </div>
          <div className="flex-1">
            <p
              className={`text-sm font-semibold ${
                step1Done ? "text-green-800" : "text-amber-900"
              }`}
            >
              {step1Done
                ? `Backup device registered (${backupDevices.length})`
                : "Step 1 — Register a backup device (required)"}
            </p>
            <p
              className={`mt-0.5 text-xs leading-relaxed ${
                step1Done ? "text-green-700" : "text-amber-800"
              }`}
            >
              {step1Done
                ? "Your account now has a recovery device. Proceed to step 2."
                : "Scan the QR code below on another phone, tablet, or laptop. This backup device lets you regain access if your primary device is unavailable."}
            </p>
          </div>
        </div>

        {/* Step 2 — revoke access */}
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 transition-colors duration-300 ${
            step2Done
              ? "border-green-200 bg-green-50"
              : step1Done
              ? "border-amber-200 bg-amber-50"
              : "border-outline-variant bg-surface-container-low opacity-40 pointer-events-none"
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {step2Done ? (
              <CheckCircle2 size={22} className="text-green-600" />
            ) : (
              <Circle
                size={22}
                className={step1Done ? "text-amber-500" : "text-on-surface-variant"}
              />
            )}
          </div>
          <div className="flex-1">
            <p
              className={`text-sm font-semibold ${
                step2Done
                  ? "text-green-800"
                  : step1Done
                  ? "text-amber-900"
                  : "text-on-surface-variant"
              }`}
            >
              {step2Done
                ? "Revoke access granted to backup device"
                : "Step 2 — Grant revoke access to the backup device (required)"}
            </p>
            <p
              className={`mt-0.5 text-xs leading-relaxed ${
                step2Done
                  ? "text-green-700"
                  : step1Done
                  ? "text-amber-800"
                  : "text-on-surface-variant"
              }`}
            >
              {step2Done
                ? "The backup device can revoke other devices if your primary device is lost."
                : "Your backup device must be granted revoke access so it can manage devices in an emergency."}
            </p>

            {/* Grant buttons — one per backup device without canRevoke */}
            {step1Done && !step2Done && (
              <div className="mt-3 flex flex-col gap-2">
                {backupDevices
                  .filter((d) => !d.canRevoke)
                  .map((d) => (
                    <button
                      key={d.id}
                      onClick={() => grantRevoke(d.id)}
                      className="inline-flex items-center gap-2 self-start rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                    >
                      🛡️ Give revoke access to &quot;{d.label}&quot;
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── QR invite ──────────────────────────────────────────── */}
      <DeviceLinkInvite onDeviceAdded={handleDeviceAdded} />

      {/* ── Manual refresh ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={loadDevices}
        disabled={checking}
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-50"
      >
        {checking ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <RefreshCw size={13} />
        )}
        {checking ? "Checking…" : "Refresh status"}
      </button>

      {/* ── Continue button ────────────────────────────────────── */}
      <button
        type="button"
        disabled={!canProceed}
        onClick={() => {
          if (canProceed) router.push("/dashboard");
        }}
        aria-disabled={!canProceed}
        className={`mt-6 h-12 w-full rounded text-sm font-semibold transition-all select-none ${
          canProceed
            ? "cursor-pointer bg-primary text-white hover:opacity-90"
            : "cursor-not-allowed bg-surface-container text-on-surface-variant opacity-50"
        }`}
        title={
          devices === null
            ? "Checking device status…"
            : !hasBackupDevice
            ? "Register a backup device first"
            : !hasRevokeGranted
            ? "Grant revoke access to your backup device first"
            : ""
        }
      >
        {devices === null ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Checking…
          </span>
        ) : canProceed ? (
          "Open dashboard →"
        ) : !hasBackupDevice ? (
          "Register a backup device to continue"
        ) : (
          "Grant revoke access to continue"
        )}
      </button>
    </AuthShell>
  );
}
