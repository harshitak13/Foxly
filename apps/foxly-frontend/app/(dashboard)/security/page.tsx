"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { api, stableClientId } from "@/lib/api";
import { useDialog } from "@/components/dialog-provider";
import { useDevices } from "@/lib/use-devices";

// ─── Backup Codes Modal ───────────────────────────────────────────────────────

function BackupCodesModal({
  codes,
  onClose,
}: {
  codes: string[];
  onClose: () => void;
}) {
  const [isSaved, setIsSaved] = useState(false);

  function downloadCSV() {
    const csv = ["Backup Code", ...codes].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "foxly-backup-codes.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function saveToPasswordManager() {
    try {
      let email = "foxly-account";
      try {
        const u = await api<{ email: string }>("/auth/me");
        if (u?.email) email = u.email;
      } catch {}
      if (!("credentials" in navigator) || !window.PasswordCredential) {
        downloadCSV();
        return;
      }
      const cred = new window.PasswordCredential({
        id: email,
        name: "Foxly backup codes",
        password: codes.join(" "),
      });
      await navigator.credentials.store(cred);
      setIsSaved(true);
    } catch {
      downloadCSV();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        {/* Header */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface text-xl leading-none"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-container text-2xl">🛡</div>
          <div>
            <h2 className="font-bold text-on-surface text-lg">New Backup Codes</h2>
            <p className="text-sm text-on-surface-variant">Store these somewhere safe.</p>
          </div>
        </div>

        {/* Warning */}
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ These codes replace your previous ones. Old codes are now invalid.
        </div>

        {/* Codes grid */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {codes.map((code, i) => (
            <div
              key={i}
              className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 font-mono text-sm font-semibold tracking-widest text-on-surface text-center select-all"
            >
              {code}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <button
              onClick={saveToPasswordManager}
              disabled={isSaved}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold transition-all ${
                isSaved ? "bg-green-600 text-white cursor-default" : "bg-primary text-white hover:opacity-90 transition-opacity"
              }`}
            >
              {isSaved ? "✓ Saved" : "💾 Password Manager"}
            </button>
            <button
              onClick={downloadCSV}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-outline-variant px-4 py-2.5 text-xs font-semibold text-primary hover:bg-surface-container transition-colors"
            >
              ⬇ Save as CSV
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full rounded-full border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Security() {
  const router = useRouter();
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const dialog = useDialog();
  const { devices, loading: devicesLoading, isCurrentDevicePrimary, currentDeviceCanRevoke, refresh: refreshDevices } = useDevices();

  async function addPasskey() {
    try {
      const options = await api<any>("/auth/device/options", {
        method: "POST",
      });
      const attestation = await startRegistration(options);
      await api("/auth/device/verify", {
        method: "POST",
        body: JSON.stringify({ attestation, stableClientId: stableClientId(), deviceLabel: "Additional passkey" }),
      });
      // Refresh the shared cache — both this page and /devices update automatically
      await refreshDevices();
      await dialog.alert({
        title: "Passkey added",
        message: "Your new passkey was registered successfully. It will now appear in your Devices list and can be used to sign in.",
        variant: "info",
        confirmText: "Got it",
      });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const cancelled =
        msg.toLowerCase().includes("not allowed") ||
        msg.toLowerCase().includes("timed out") ||
        msg.toLowerCase().includes("cancelled") ||
        msg.toLowerCase().includes("abort");
      if (cancelled) {
        // User dismissed the browser passkey prompt — no alert needed
        return;
      }
      await dialog.alert({
        title: "Passkey registration failed",
        message: msg || "Something went wrong while registering the passkey. Please try again.",
        variant: "error",
      });
    }
  }

  async function revokeDevice(id: string) {
    const target = devices.find((d) => d.id === id);
    if (target?.isCurrent) {
      await dialog.alert({
        title: "Cannot revoke current device",
        message: "A device cannot revoke itself. Please use another authorized device to revoke this device, or sign out.",
        variant: "warning",
      });
      return;
    }

    const remainingBackupDevices = devices.filter((d) => !d.isPrimary && d.id !== id);
    if (target?.canRevoke && remainingBackupDevices.length > 0) {
      const otherBackupWithRevoke = remainingBackupDevices.filter((d) => d.canRevoke);
      if (otherBackupWithRevoke.length === 0) {
        await dialog.alert({
          title: "Cannot revoke device",
          message: "At least one device other than the primary device must have revoke access enabled. Please grant revoke access to another device before revoking this device.",
          variant: "warning",
        });
        return;
      }
    }

    if (await dialog.confirm({
      title: "Revoke passkey & device",
      message: "Are you sure you want to revoke and delete this passkey? The device and passkey will be permanently removed from the database and cannot be used to sign in again.",
      confirmText: "Revoke",
      variant: "error"
    })) {
      try {
        await api(`/devices/${id}`, { method: "DELETE" });
        await refreshDevices();
      } catch (err) {
        dialog.alert({ message: (err as Error).message, variant: "error" });
      }
    }
  }

  async function handleGrantRevoke(id: string, label: string) {
    try {
      await api(`/devices/${id}/grant-revoke`, { method: "POST" });
      await refreshDevices();
      dialog.alert({
        title: "Revoke access granted",
        message: `Revoke access has been granted to device "${label}".`,
        variant: "info",
      });
    } catch (err) {
      dialog.alert({ message: (err as Error).message, variant: "error" });
    }
  }

  async function handleRemoveRevoke(id: string, label: string) {
    const target = devices.find((d) => d.id === id);
    if (target?.canRevoke) {
      const otherBackupWithRevoke = devices.filter((d) => !d.isPrimary && d.canRevoke && d.id !== id);
      if (otherBackupWithRevoke.length === 0) {
        await dialog.alert({
          title: "Cannot remove revoke access",
          message: "At least one device other than the primary device must have revoke access enabled.",
          variant: "warning",
        });
        return;
      }
    }

    try {
      await api(`/devices/${id}/revoke-revoke`, { method: "POST" });
      await refreshDevices();
      dialog.alert({
        title: "Revoke access removed",
        message: `Revoke access has been removed from device "${label}".`,
        variant: "info",
      });
    } catch (err) {
      dialog.alert({ message: (err as Error).message, variant: "error" });
    }
  }

  async function regenerateCodes() {
    if (await dialog.confirm({ message: "Regenerating backup codes will invalidate all your old emergency codes. Proceed?", variant: "warning" })) {
      try {
        const data = await api<{ codes: string[] }>("/auth/recovery/complete", {
          method: "POST",
        });
        setBackupCodes(data.codes);

        // Auto-save to Password Manager
        try {
          let email = "foxly-account";
          try {
            const u = await api<{ email: string }>("/auth/me");
            if (u?.email) email = u.email;
          } catch {}
          if ("credentials" in navigator && window.PasswordCredential) {
            const cred = new window.PasswordCredential({
              id: email,
              name: "Foxly backup codes",
              password: data.codes.join(" "),
            });
            await navigator.credentials.store(cred);
          }
        } catch {}
      } catch (err) {
        dialog.alert({ message: "Failed to regenerate codes: " + (err as Error).message, variant: "error" });
      }
    }
  }

  async function signoutEverywhere() {
    if (await dialog.confirm({ title: "Sign out everywhere", message: "Sign out everywhere?\n\nThis will sign you out on all devices. You will need to log in again.", variant: "warning", confirmText: "Sign out" })) {
      try {
        await api("/auth/signout-everywhere", { method: "POST" });
        router.push("/sign-in");
      } catch (err) {
        dialog.alert({ message: "Failed: " + (err as Error).message, variant: "error" });
      }
    }
  }

  async function deleteAccount() {
    if (await dialog.confirm({ title: "Delete account", message: "Delete account permanently?\n\nThis action cannot be undone. All account data, devices, passkeys, and sessions will be permanently removed.", confirmText: "Delete forever", variant: "error" })) {
      try {
        await api("/auth/delete-account", { method: "DELETE" });
        router.push("/sign-in");
      } catch (err) {
        dialog.alert({ message: "Failed: " + (err as Error).message, variant: "error" });
      }
    }
  }

  return (
    <div>
      {/* Backup codes modal */}
      {backupCodes && (
        <BackupCodesModal codes={backupCodes} onClose={() => setBackupCodes(null)} />
      )}

      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs text-on-surface-variant mb-1">
          Guardian View · <span className="font-semibold text-primary">Trust Level: High</span>
        </p>
        <h1 className="font-display text-4xl font-bold text-on-surface">Security Settings</h1>
        <p className="mt-2 text-on-surface-variant">Manage your account's protection and authentication methods.</p>
      </div>

      <div className="space-y-4">
        {/* Passkeys section */}
        <div className="rounded-xl border border-outline-variant bg-white shadow-sm">
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-orange-100 text-2xl">🔑</div>
              <div>
                <p className="font-bold text-on-surface text-lg">Passkeys</p>
                <p className="text-sm text-on-surface-variant">Biometric or hardware keys for secure, passwordless login.</p>
              </div>
            </div>
            <button
              onClick={addPasskey}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-container transition-colors"
            >
              + Add another passkey
            </button>
          </div>
          <div className="border-t border-outline-variant">
            {devicesLoading ? (
              <div className="px-6 py-4 space-y-3">
                {[1,2].map(i => (
                  <div key={i} className="h-6 w-2/3 rounded bg-surface-container animate-pulse" />
                ))}
              </div>
            ) : devices.length === 0 ? (
              <p className="px-6 py-4 text-sm text-on-surface-variant">No passkeys registered yet.</p>
            ) : (
              devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-6 py-4 border-b border-outline-variant last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-lg">✅</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-on-surface">{d.label}</span>
                        {d.isCurrent && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700">
                            Active on this device
                          </span>
                        )}
                        {d.isPrimary && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                            Primary Device
                          </span>
                        )}
                        {!d.isPrimary && d.canRevoke && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            Revoke Access Granted
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Added {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {d.lastUsedAt && <> · Last used {new Date(d.lastUsedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* "Give revoke access" button — ONLY visible to Primary device beside registered NEW devices */}
                    {isCurrentDevicePrimary && !d.isPrimary && (
                      !d.canRevoke ? (
                        <button
                          onClick={() => handleGrantRevoke(d.id, d.label)}
                          className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
                        >
                          🛡️ Give revoke access
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRemoveRevoke(d.id, d.label)}
                          className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-red-50 hover:text-red-700 transition-colors"
                        >
                          ✓ Revoke access granted
                        </button>
                      )
                    )}
                    {d.isCurrent ? (
                      <span className="text-xs font-semibold text-on-surface-variant">Active</span>
                    ) : currentDeviceCanRevoke ? (
                      <button
                        onClick={() => revokeDevice(d.id)}
                        className="text-sm font-semibold text-red-600 hover:underline"
                      >
                        Revoke
                      </button>
                    ) : (
                      <span
                        title="Only primary device or authorized devices can revoke other devices"
                        className="text-xs font-semibold text-on-surface-variant opacity-60 cursor-not-allowed"
                      >
                        No Revoke Permission
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Backup Codes */}
        <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-container text-2xl">🛡</div>
            <div>
              <p className="font-bold text-on-surface text-lg">Backup Codes</p>
              <p className="text-sm text-on-surface-variant">
                <strong>3 codes remaining.</strong> Use these if you lose access to your other login methods.
              </p>
            </div>
          </div>
          <button
            onClick={regenerateCodes}
            className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline"
          >
            Regenerate codes ↺
          </button>
        </div>

        {/* Advanced Guardian Protection */}
        <div className="rounded-xl border-l-4 border-l-green-600 border border-outline-variant bg-surface-container-low p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="text-2xl mt-0.5">✅</div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-700 mb-1">Advanced Guardian Protection</p>
                <p className="text-sm text-on-surface">
                  Foxly automatically asks for extra confirmation when a sign-in looks unusual. This layer of security is always active for your protection.
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 ml-4 shrink-0">
              {[1,2,3,4].map(i => (
                <div key={i} className={`h-2 w-5 rounded-full ${i <= 3 ? "bg-primary" : "bg-outline-variant"}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 border-t border-outline-variant" />
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Danger Zone</span>
            <div className="flex-1 border-t border-outline-variant" />
          </div>
          <div className="rounded-xl border border-outline-variant bg-white shadow-sm divide-y divide-outline-variant">
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold text-on-surface">Sign out of all devices</p>
                <p className="text-sm text-on-surface-variant">Force logout on all active sessions excluding this one.</p>
              </div>
              <button
                onClick={signoutEverywhere}
                className="flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
              >
                ↪ Sign out everywhere
              </button>
            </div>
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold text-on-surface">Delete account</p>
                <p className="text-sm text-on-surface-variant">Permanently remove your account and all associated data.</p>
              </div>
              <button
                onClick={deleteAccount}
                className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
