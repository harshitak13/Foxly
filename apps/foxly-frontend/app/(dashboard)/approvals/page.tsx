"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useDialog } from "@/components/dialog-provider";
import type { Approval } from "shared-types";

const RECENT_VERIFICATIONS = [
  { name: "Sarah K.", action: "Update Firewall Rules", time: "1h ago", status: "Approved" },
  { name: "Marcus T.", action: "Database Schema Change", time: "3h ago", status: "Approved" },
];

export default function Approvals() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [pending, setPending] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const dialog = useDialog();

  useEffect(() => {
    api<any>("/approvals?status=pending")
      .then((d) => setPending(Array.isArray(d.approvals) ? d.approvals : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function approve(id: string) {
    try {
      await api(`/approvals/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ passkeyAssertion: "mock" }),
      });
      setPending((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      dialog.alert({ message: (err as Error).message, variant: "error" });
    }
  }

  async function reject(id: string) {
    try {
      await api(`/approvals/${id}/reject`, {
        method: "POST"
      });
      setPending((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      dialog.alert({ message: (err as Error).message, variant: "error" });
    }
  }

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div>
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Guardian</span>
            <span className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Trust Level: <span className="text-on-surface">High</span></span>
          </div>
          <h1 className="font-display text-4xl font-bold text-on-surface">Approvals</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Verify critical system actions and deployment requests.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-outline-variant mb-6">
          {(["pending", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors ${
                tab === t ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t === "pending" ? (
                <span className="flex items-center gap-2">
                  Pending
                  {pending.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{pending.length}</span>
                  )}
                </span>
              ) : "History"}
            </button>
          ))}
        </div>

        {/* Pending approvals */}
        {tab === "pending" && (
          <div className="space-y-4">
            {loading ? (
              <p className="text-on-surface-variant">Loading…</p>
            ) : pending.length === 0 ? (
              <div className="rounded-xl border border-outline-variant bg-white p-8 text-center">
                <p className="text-on-surface-variant">No pending approvals. You're all caught up!</p>
              </div>
            ) : (
              pending.map((a) => (
                <div key={a.id} className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-100 text-xl">🚀</div>
                      <div>
                        <p className="font-bold text-on-surface">{a.title}</p>
                        <p className="text-sm text-on-surface-variant">{a.description}</p>
                      </div>
                    </div>
                    <span className="text-xs text-on-surface-variant">2m ago</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-5 text-xs text-on-surface-variant">
                    <div>
                      <p className="uppercase tracking-wider font-semibold mb-1">Requester</p>
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-surface-container grid place-items-center text-xs">👤</div>
                        <span className="text-on-surface font-semibold">Alex V.</span>
                      </div>
                    </div>
                    <div>
                      <p className="uppercase tracking-wider font-semibold mb-1">Application</p>
                      <span className="text-on-surface font-semibold">⚙ Relay</span>
                    </div>
                    <div>
                      <p className="uppercase tracking-wider font-semibold mb-1">Environment</p>
                      <span className="text-on-surface font-semibold flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                        Production
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
                      <span>{a.currentApprovals} of {a.requiredApprovals} approvals given (Quorum Requirement)</span>
                      <span>{Math.round((a.currentApprovals / a.requiredApprovals) * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(a.currentApprovals / a.requiredApprovals) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => approve(a.id)}
                      className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-container transition-colors"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => reject(a.id)}
                      className="flex items-center gap-2 rounded-full border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
                    >
                      ⊘ Reject
                    </button>
                    <button className="text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors">
                      View Manifest
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "history" && (
          <p className="text-on-surface-variant">No history available.</p>
        )}

        {/* Recent Verifications */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-on-surface">Recent Verifications</h2>
            <button className="text-sm font-semibold text-primary hover:underline">View All History →</button>
          </div>
          <div className="rounded-xl border border-outline-variant bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th className="px-5 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Requester</th>
                  <th className="px-5 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Action</th>
                  <th className="px-5 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Time</th>
                  <th className="px-5 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {RECENT_VERIFICATIONS.map((v) => (
                  <tr key={v.name + v.action} className="hover:bg-surface-container-low">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-surface-container grid place-items-center text-sm">👤</div>
                        <span className="font-semibold text-on-surface">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-on-surface">{v.action}</td>
                    <td className="px-5 py-3 text-on-surface-variant">{v.time}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-green-700 font-semibold">
                        ✅ {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4 pt-[132px]">
        <div className="rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-primary">ℹ</span>
            <p className="font-bold text-on-surface">Risk Assessment</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">System Impact</span>
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-bold uppercase text-yellow-700">Moderate</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Dependency Check</span>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold uppercase text-green-700">Passed</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-on-surface-variant italic border-t border-outline-variant pt-3">
            "The last 3 deployments to Relay were successful with zero downtime alerts."
          </p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
          <p className="font-bold text-primary mb-1">Watchful Guard</p>
          <p className="text-sm text-on-surface-variant">Foxly AI is monitoring this request for anomalies.</p>
          <div className="mt-3 flex gap-1.5">
            {[1,2,3,4].map(i => (
              <div key={i} className={`h-2 flex-1 rounded-full ${i <= 3 ? "bg-primary" : "bg-orange-200"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
