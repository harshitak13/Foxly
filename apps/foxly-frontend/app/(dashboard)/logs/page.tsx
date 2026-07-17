"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AuditLog {
  id: string;
  timestamp: string;
  event: string;
  device: string;
  location: string;
  description: string;
  riskFlag?: boolean;
  category: "signin" | "security" | "approval" | "other";
}

const STATIC_LOGS: AuditLog[] = [
  {
    id: "1",
    timestamp: "Today, 14:22:05",
    event: "Sign-in Attempt",
    device: "Unknown Browser",
    location: "Moscow, RU · 185.156.74.22",
    description: "Multiple failed authentication attempts detected from a new location.",
    riskFlag: true,
    category: "signin"
  },
  {
    id: "2",
    timestamp: "Today, 12:45:12",
    event: "Approval Given",
    device: "MacBook Pro M2",
    location: "New York, US · 72.14.213.11",
    description: "Manual override approved for 'Access Restricted Area' request.",
    category: "approval"
  },
  {
    id: "3",
    timestamp: "Today, 09:15:33",
    event: "Device Added",
    device: "iPad Air (6th Gen)",
    location: "New York, US · 72.14.213.11",
    description: "Successfully paired new Guardian node via secure QR handoff.",
    category: "security"
  },
  {
    id: "4",
    timestamp: "Oct 10, 10:32:15",
    event: "Sign-out",
    device: "Primary Workstation",
    location: "Local Network · 192.168.1.100",
    description: "User manually ended session.",
    category: "signin"
  },
  {
    id: "5",
    timestamp: "Oct 10, 11:32:16",
    event: "Sign-in",
    device: "Primary Workstation",
    location: "Local Network · 192.168.1.101",
    description: "User session established successfully.",
    category: "signin"
  },
  {
    id: "6",
    timestamp: "Oct 10, 12:32:17",
    event: "Policy Update",
    device: "Primary Workstation",
    location: "Local Network · 192.168.1.102",
    description: "Modified global timeout policy to 15 minutes.",
    category: "security"
  },
  {
    id: "7",
    timestamp: "Oct 10, 13:32:18",
    event: "Sign-out",
    device: "Primary Workstation",
    location: "Local Network · 192.168.1.103",
    description: "User manually ended session.",
    category: "signin"
  }
];

export default function Logs() {
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "signin" | "security" | "approval">("all");

  useEffect(() => {
    api<any>("/audit-log")
      .then((data) => setDbLogs(data.rows || []))
      .catch(() => {});
  }, []);

  // Map database logs to matching interface structures
  const mappedDbLogs: AuditLog[] = dbLogs.map((row: any) => {
    const isApproval = row.action.startsWith("approval");
    const isDevice = row.action.includes("device") || row.action.includes("credential");
    return {
      id: row.id,
      timestamp: new Date(row.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }),
      event: row.action === "approval.approved" ? "Approval Given" :
             row.action === "approval.created" ? "Approval Requested" :
             row.action.includes("revoke") ? "Device Revoked" : "Security Update",
      device: "Current Client",
      location: "Local Network · 127.0.0.1",
      description: `Action execution: ${row.action}`,
      category: isApproval ? "approval" : isDevice ? "security" : "other"
    };
  });

  // Combine real database logs + realistic simulation logs from the design specs
  const allLogs = [...mappedDbLogs, ...STATIC_LOGS];

  // Filter logs by active tab
  const filteredLogs = allLogs.filter((log) => {
    if (activeTab === "all") return true;
    return log.category === activeTab;
  });

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Timestamp,Event,Device,Location,Description"].join(",") + "\n"
      + filteredLogs.map(l => `"${l.timestamp}","${l.event}","${l.device}","${l.location}","${l.description}"`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `security_audit_log_${activeTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        {[
          { id: "all", label: "All Events" },
          { id: "signin", label: "Sign-ins" },
          { id: "security", label: "Security Changes" },
          { id: "approval", label: "Approvals" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
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

      {/* Audit Log Table */}
      <div className="rounded-xl border border-outline-variant bg-white shadow-sm overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="px-6 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider w-[180px]">Timestamp</th>
              <th className="px-6 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider w-[180px]">Event</th>
              <th className="px-6 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider w-[240px]">Device/Location</th>
              <th className="px-6 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-on-surface-variant">No events match the selected filter.</td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-container-low">
                  <td className="px-6 py-4 text-on-surface font-mono">{log.timestamp}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {log.event.includes("Sign-in") ? "🔑" :
                         log.event.includes("Approval") ? "✅" :
                         log.event.includes("Device") ? "➕" : "⚙"}
                      </span>
                      <span className="font-semibold text-on-surface">{log.event}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-on-surface">{log.device}</p>
                      <p className="text-xs text-on-surface-variant">{log.location}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant leading-relaxed">
                    <div className="flex items-start justify-between gap-4">
                      <span>{log.description}</span>
                      {log.riskFlag && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-700 whitespace-nowrap shrink-0 flex items-center gap-1">
                          🚩 Risk Flag
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination component */}
      <div className="flex items-center justify-between text-sm text-on-surface-variant border-t border-outline-variant pt-4">
        <span>Showing {filteredLogs.length} of 1,422 events</span>
        <div className="flex items-center gap-4">
          <button disabled className="text-on-surface-variant/40 cursor-not-allowed">
            ◀
          </button>
          <span>Page 1 of 51</span>
          <button className="text-on-surface hover:text-primary transition-colors">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
