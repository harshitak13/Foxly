"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ActivityRow {
  id: string;
  action: string;
  label: string;
  icon: string;
  category: string;
  device: string | null;
  createdAt: string;
}

type Tab = "all" | "signin" | "security" | "approval";

// undefined locale = browser auto-detects user's locale and timezone
function formatTs(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);

  if (isToday) {
    return `${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(d)}, ${time}`;
  }

  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  }).format(d);

  return `${date}, ${time}`;
}


export default function Logs() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("all");

  useEffect(() => {
    // Fetch the full audit log and use the same /activity label mapping
    api<any>("/audit-log")
      .then((data) => {
        const ACTION_META: Record<string, { label: string; icon: string; category: string }> = {
          "auth.signin.success":               { label: "Signed in",                icon: "🔑", category: "signin" },
          "auth.signin.recovery":              { label: "Signed in via backup code", icon: "🛡", category: "signin" },
          "auth.signout":                      { label: "Signed out",                icon: "🚪", category: "signin" },
          "auth.signout_everywhere":           { label: "Signed out everywhere",     icon: "🚪", category: "signin" },
          "device.registered":                 { label: "Device registered",         icon: "➕", category: "security" },
          "device.authentication.completed":   { label: "Signed in",                icon: "🔑", category: "signin" },
          "device.revoked":                    { label: "Device revoked",            icon: "🗑", category: "security" },
          "device_link.created":               { label: "Device link QR created",    icon: "📲", category: "security" },
          "device_link.scanned":               { label: "Device link QR scanned",   icon: "📲", category: "security" },
          "device_link.completed":             { label: "Backup device linked",      icon: "✅", category: "security" },
          "security.backup_codes_regenerated": { label: "Backup codes regenerated",  icon: "🔄", category: "security" },
          "approval.created":                  { label: "Approval requested",        icon: "📋", category: "approval" },
          "approval.approved":                 { label: "Approval granted",          icon: "✅", category: "approval" },
          "approval.rejected":                 { label: "Approval rejected",         icon: "❌", category: "approval" },
          "auth_link.created":                 { label: "Auth link created",         icon: "🔗", category: "signin" },
          "auth_link.scanned":                 { label: "Auth link scanned",         icon: "🔗", category: "signin" },
          "auth_link.completed":               { label: "Auth link sign-in complete",icon: "✅", category: "signin" },
        };
        const mapped: ActivityRow[] = (data.rows ?? [])
          .slice()
          .reverse()
          .map((r: any) => {
            const meta = ACTION_META[r.action] ?? { label: r.action, icon: "⚙", category: "other" };
            const m = r.metadata ?? {};
            return {
              id: r.id,
              action: r.action,
              label: meta.label,
              icon: meta.icon,
              category: meta.category,
              device: typeof m.deviceLabel === "string" ? m.deviceLabel : null,
              createdAt: r.createdAt,
            };
          });
        setRows(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => activeTab === "all" || r.category === activeTab);

  const handleExport = () => {
    const csv =
      "Timestamp,Event,Device,Action\n" +
      filtered
        .map((r) => `"${formatTs(r.createdAt)}","${r.label}","${r.device ?? "—"}","${r.action}"`)
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `foxly-audit-log-${activeTab}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface">Security Audit Logs</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Review all activities and access events within your Guardian network.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-outline bg-white px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors shadow-sm"
        >
          <span>📥</span> Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant mb-6">
        {([
          { id: "all", label: "All Events" },
          { id: "signin", label: "Sign-ins" },
          { id: "security", label: "Security Changes" },
          { id: "approval", label: "Approvals" },
        ] as { id: Tab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-[2px] ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-outline-variant bg-white shadow-sm overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="px-6 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider w-[200px]">Timestamp</th>
              <th className="px-6 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider w-[220px]">Event</th>
              <th className="px-6 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Device</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center">
                  <span className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading audit log...
                  </span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-sm text-on-surface-variant">
                  {rows.length === 0
                    ? "No events recorded yet. Activity appears here as you use your account."
                    : "No events match the selected filter."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-on-surface-variant whitespace-nowrap">
                    {formatTs(row.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{row.icon}</span>
                      <span className="font-semibold text-on-surface">{row.label}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {row.device ?? <span className="text-on-surface-variant/50 italic">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-on-surface-variant border-t border-outline-variant pt-4">
        <span>Showing {filtered.length} of {rows.length} event{rows.length !== 1 ? "s" : ""}</span>
        <span className="text-xs">Sorted by most recent first</span>
      </div>
    </div>
  );
}
