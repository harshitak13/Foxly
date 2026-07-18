"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useDevices } from "@/lib/use-devices";
import { DeviceLinkInvite } from "@/components/device-link-invite";
import { useDialog } from "@/components/dialog-provider";

// Map device label keywords → icon + browser hint
function deviceIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("mac") || l.includes("laptop") || l.includes("workstation")) return { icon: "💻", hint: "macOS" };
  if (l.includes("key") || l.includes("yubi")) return { icon: "🔑", hint: "Hardware Security Key" };
  if (l.includes("iphone") || l.includes("android") || l.includes("mobile") || l.includes("phone")) return { icon: "📱", hint: "Mobile App" };
  return { icon: "📱", hint: "Native App" };
}

function formatDate(iso: string | null) {
  if (!iso) return "Just now";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Devices() {
  const router = useRouter();
  const { devices, loading, refresh } = useDevices();
  const dialog = useDialog();

  const handleRevoke = async (id: string) => {
    if (await dialog.confirm({ message: "Are you sure you want to revoke this device?", isDanger: true })) {
      try {
        await api(`/devices/${id}`, { method: "DELETE" });
        refresh(); // instant update — no page reload needed
      } catch (err) {
        dialog.alert({ message: (err as Error).message, isDanger: true });
      }
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface">Device Management</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Monitor and manage access from your trusted hardware.
          </p>
        </div>
        <button className="flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface">
          <span>❓</span> Help Center
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button className="rounded-full border border-outline bg-surface-container-low px-4 py-1.5 text-sm font-semibold text-on-surface">
            All Devices
          </button>
        </div>
        <span className="text-sm text-on-surface-variant">{devices.length} device{devices.length !== 1 ? "s" : ""} total</span>
      </div>

      {/* Device table */}
      <div className="rounded-xl border border-outline-variant bg-white shadow-sm overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="px-6 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Device Name</th>
              <th className="px-6 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Registered</th>
              <th className="px-6 py-3 text-right font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-on-surface-variant">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading devices...
                  </span>
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-on-surface-variant">No devices registered.</td>
              </tr>
            ) : (
              devices.map((d, index) => {
                const { icon, hint } = deviceIcon(d.label);
                return (
                  <tr key={d.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{icon}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-on-surface">{d.label}</span>
                            {index === 0 && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-700">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-on-surface-variant">{hint}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-on-surface font-semibold">{formatDate(d.lastUsedAt)}</p>
                      <p className="text-xs text-on-surface-variant">Added {formatDate(d.createdAt)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {index === 0 ? (
                        <span className="text-xs font-semibold text-on-surface-variant">Active</span>
                      ) : (
                        <button
                          onClick={() => handleRevoke(d.id)}
                          className="text-sm font-semibold text-red-600 hover:text-red-800 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dots separator */}
      <div className="flex justify-center gap-1.5 mb-8">
        {[1, 2, 4, 5].map((i) => (
          <div key={i} className={`h-2 w-2 rounded-full ${i === 4 ? "bg-primary" : "bg-outline-variant"}`} />
        ))}
      </div>

      {/* Empty state / security note */}
      {devices.length <= 1 && (
        <div className="flex flex-col items-center text-center max-w-xl mx-auto py-6">
          <div className="relative mb-4">
            <div className="h-24 w-24 rounded-full bg-surface-container flex items-center justify-center text-4xl border border-outline-variant">
              🛡️
            </div>
            <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-1 text-xs border-2 border-white">
              ✓
            </div>
          </div>
          <h2 className="text-lg font-bold text-on-surface mb-2">Account is purely secure</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            No other devices yet—your account is secure on this device. We'll notify you immediately if a new sign-in attempt is detected from an unrecognized hardware.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => router.push("/logs")}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
            >
              View Audit Log
            </button>
            <button
              onClick={() => router.push("/security")}
              className="rounded-lg border border-outline-variant bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:bg-surface-container transition-colors"
            >
              Setup Backup Key
            </button>
          </div>
        </div>
      )}

      {/* QR invite — refresh device list the moment a new device completes */}
      <div className="mx-auto max-w-xl">
        <DeviceLinkInvite onDeviceAdded={refresh} />
      </div>
    </div>
  );
}
