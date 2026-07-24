"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useDevices } from "@/lib/use-devices";
import { useActivity } from "@/lib/use-activity";

// Uses the browser's locale automatically — no hardcoded "en-US"
function formatRelative(iso: string | null): { label: string; color: string; absolute: string } {
  if (!iso) return { label: "Just now", color: "text-primary", absolute: "" };
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHrs  = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  // Absolute timestamp in the user's own locale + timezone for the tooltip
  const absolute = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  let label: string;
  if (diffSecs < 60)  label = rtf.format(-diffSecs, "second");
  else if (diffMins < 60) label = rtf.format(-diffMins, "minute");
  else if (diffHrs  < 24) label = rtf.format(-diffHrs,  "hour");
  else                    label = rtf.format(-diffDays, "day");

  const color = diffMins < 2 ? "text-primary" : "text-on-surface-variant";
  return { label, color, absolute };
}


export default function Dashboard() {
  const router = useRouter();
  const { devices } = useDevices();
  const { activity, loading: activityLoading } = useActivity();
  const [stats, setStats] = useState<{ backupCodesUnused: number; recentRiskFlags: number } | null>(null);

  // Real last sign-in: most recent auth.signin.* event from the activity feed
  const lastSignIn = activity.find(
    (a) => a.action === "auth.signin.success" || a.action === "auth.signin.recovery" || a.action === "device.authentication.completed"
  ) ?? null;

  useEffect(() => {
    api<{ backupCodesUnused: number; recentRiskFlags: number }>("/auth/stats")
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">System Status</p>
          <h1 className="font-display text-4xl font-bold text-on-surface">Guardian Overview</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />
          All systems active
        </div>
      </div>

      {/* Security status card */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-green-100 text-3xl">✅</div>
          <div>
            <p className="text-lg font-bold text-on-surface">Your account is secure</p>
            <p className="text-sm text-on-surface-variant">
              {lastSignIn ? (() => {
                const { label, color, absolute } = formatRelative(lastSignIn.createdAt);
                return (
                  <>
                    Last sign-in:{" "}
                    {lastSignIn.device && <strong>{lastSignIn.device} · </strong>}
                    <span
                      className={`font-semibold ${color}`}
                      title={absolute}
                    >
                      {label}
                    </span>
                  </>
                );
              })() : devices.length === 0 ? (
                "No devices registered yet."
              ) : (
                "Sign in again to record your last sign-in time."
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/security")}
          className="rounded-lg border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
        >
          Review Security
        </button>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: "💻", label: "Active Devices", value: devices.length, badge: "LIVE", badgeColor: "bg-green-100 text-green-700" },
          { icon: "🔑", label: "Backup Codes Unused", value: stats !== null ? stats.backupCodesUnused : "...", badge: "RESERVE", badgeColor: "bg-surface-container text-on-surface-variant" },
          { icon: "🚩", label: "Recent Risk Flags", value: stats !== null ? stats.recentRiskFlags : "...", badge: stats !== null && stats.recentRiskFlags > 0 ? "WARNING" : "CLEAN", badgeColor: stats !== null && stats.recentRiskFlags > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700" },
        ].map(({ icon, label, value, badge, badgeColor }) => (
          <div key={label} className="rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl">{icon}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>{badge}</span>
            </div>
            <p className="font-display text-4xl font-bold text-on-surface">{value}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{label}</p>
          </div>
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-on-surface">Recent Activity</h2>
            <button onClick={() => router.push("/logs")} className="text-sm font-semibold text-primary hover:underline">View All</button>
          </div>
          <div className="rounded-xl border border-outline-variant bg-white shadow-sm divide-y divide-outline-variant">
            {activityLoading ? (
              <div className="px-5 py-8 flex items-center justify-center gap-2 text-sm text-on-surface-variant">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading activity...
              </div>
            ) : activity.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-on-surface-variant">
                No activity yet. Sign out and back in to see events here.
              </div>
            ) : (
              activity.slice(0, 5).map((item) => {
                const { label: timeLabel, color: timeColor, absolute } = formatRelative(item.createdAt);
                return (
                  <div key={item.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-surface-container text-lg shrink-0">{item.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                        <p className="text-xs text-on-surface-variant">
                          {item.device ?? "Foxly account"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold ${timeColor}`}
                      title={absolute}
                    >
                      {timeLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Guardian Insights */}
        <div>
          <h2 className="text-lg font-bold text-on-surface mb-4">Guardian Insights</h2>
          <div className="rounded-xl bg-on-surface p-5 text-white">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Active Protection</p>
            <p className="font-bold text-base mb-1">Always Watching.</p>
            <p className="text-sm text-gray-300">Foxly has blocked 14 unauthorized probe attempts this week.</p>
            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Current Scanning State</p>
              <div className="mt-2 flex gap-1.5">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`h-2 flex-1 rounded-full ${i <= 3 ? "bg-primary" : "bg-gray-600"}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
