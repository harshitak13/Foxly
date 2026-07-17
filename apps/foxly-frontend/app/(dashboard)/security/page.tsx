"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { api, stableClientId } from "@/lib/api";

export default function Security() {
  const router = useRouter();
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    api<any>("/devices").then((d) => setDevices(d.devices)).catch(() => {});
  }, []);

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
      const d = await api<any>("/devices");
      setDevices(d.devices);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function revokeDevice(id: string) {
    await api(`/devices/${id}`, { method: "DELETE" });
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }

  async function regenerateCodes() {
    const email = sessionStorage.getItem("foxly_email") ?? "";
    const data = await api<{ codes: string[] }>("/auth/signup/backup-codes", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    alert("New recovery codes:\n\n" + data.codes.join("\n"));
  }

  async function signoutEverywhere() {
    if (confirm("Sign out everywhere?\n\nThis will sign you out on all devices. You will need to log in again.")) {
      try {
        await api("/auth/signout-everywhere", { method: "POST" });
        router.push("/sign-in");
      } catch (err) {
        alert("Failed: " + (err as Error).message);
      }
    }
  }

  async function deleteAccount() {
    if (confirm("Delete account permanently?\n\nThis action cannot be undone. All account data, devices, passkeys, and sessions will be permanently removed.")) {
      try {
        await api("/auth/delete-account", { method: "DELETE" });
        router.push("/sign-in");
      } catch (err) {
        alert("Failed: " + (err as Error).message);
      }
    }
  }

  return (
    <div>
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
            {devices.length === 0 ? (
              <p className="px-6 py-4 text-sm text-on-surface-variant">No passkeys registered yet.</p>
            ) : (
              devices.map((d, i) => (
                <div key={d.id} className="flex items-center justify-between px-6 py-4 border-b border-outline-variant last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-lg">✅</span>
                    <div>
                      <span className="font-semibold text-sm text-on-surface">{d.label}</span>
                      {i === 0 && (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700">
                          Active on this device
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-on-surface-variant">
                      Added {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <button
                      onClick={() => revokeDevice(d.id)}
                      className="text-sm font-semibold text-red-600 hover:underline"
                    >
                      Revoke
                    </button>
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
