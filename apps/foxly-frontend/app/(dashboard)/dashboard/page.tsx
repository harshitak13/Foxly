"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const RECENT_ACTIVITY = [
  { icon: "💻", title: "Sign-in from MacBook Pro", sub: "Chrome · San Francisco, US", time: "Just now", timeColor: "text-primary" },
  { icon: "📱", title: "New Device Added: iPhone 15 Pro", sub: "Official App · London, UK", time: "2 hours ago", timeColor: "text-on-surface-variant" },
  { icon: "👤", title: "Passkey Setup Complete", sub: "Hardware Token Auth", time: "Yesterday", timeColor: "text-on-surface-variant" },
];

export default function Dashboard() {
  const router = useRouter();
  const [devices, setDevices] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);

  useEffect(() => {
    api<any>("/devices").then((d) => setDevices(Array.isArray(d.devices) ? d.devices : [])).catch(() => {});
    api<any>("/approvals?status=pending").then((d) => setApprovals(Array.isArray(d.approvals) ? d.approvals : [])).catch(() => {});
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
          Last Scanned: 2m ago
        </div>
      </div>

      {/* Security status card */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-green-100 text-3xl">✅</div>
          <div>
            <p className="text-lg font-bold text-on-surface">Your account is secure</p>
            <p className="text-sm text-on-surface-variant">
              Last sign-in: <strong>MacBook Pro 14</strong> · San Francisco, US · <span className="text-primary font-semibold">Just now</span>
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
      <div className="mb-8 grid grid-cols-4 gap-4">
        {[
          { icon: "💻", label: "Active Devices", value: devices.length || 0, badge: "SYSTEM", badgeColor: "bg-surface-container text-on-surface-variant" },
          { icon: "📋", label: "Pending Approval", value: approvals.length || 0, badge: "ACTION", badgeColor: "bg-orange-100 text-orange-700" },
          { icon: "🔑", label: "Backup Codes Unused", value: 3, badge: "RESERVE", badgeColor: "bg-surface-container text-on-surface-variant" },
          { icon: "🚩", label: "Recent Risk Flags", value: 0, badge: "CLEAN", badgeColor: "bg-green-100 text-green-700" },
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
      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-on-surface">Recent Activity</h2>
            <button onClick={() => router.push("/logs")} className="text-sm font-semibold text-primary hover:underline">View All</button>
          </div>
          <div className="rounded-xl border border-outline-variant bg-white shadow-sm divide-y divide-outline-variant">
            {RECENT_ACTIVITY.map((item) => (
              <div key={item.title} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-surface-container text-lg shrink-0">{item.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                    <p className="text-xs text-on-surface-variant">{item.sub}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${item.timeColor}`}>{item.time}</span>
              </div>
            ))}
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
