"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useDialog } from "@/components/dialog-provider";

interface Notification {
  id: string;
  text: string;
  read: boolean;
  createdAt: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const dialog = useDialog();

  const fetchNotifications = () => {
    api<{ notifications: Notification[] }>("/notifications")
      .then((d) => setNotifications(Array.isArray(d.notifications) ? d.notifications : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api("/notifications/read-all", { method: "POST" });
      fetchNotifications();
    } catch (err) {
      dialog.alert({ message: "Failed to mark read: " + (err as Error).message, isDanger: true });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/notifications/${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      dialog.alert({ message: "Failed to delete notification: " + (err as Error).message, isDanger: true });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface">Notifications</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Stay updated with device pairings, logins, and system changes.
          </p>
        </div>
        {notifications.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="rounded-xl border border-outline-variant bg-white shadow-sm overflow-hidden divide-y divide-outline-variant">
        {loading ? (
          <p className="px-6 py-8 text-center text-on-surface-variant">Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-12 text-center text-on-surface-variant">
            <span className="text-4xl block mb-2">🔔</span>
            <p className="font-semibold text-on-surface">All caught up!</p>
            <p className="text-xs mt-1">No alerts or notifications at this time.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`flex items-start justify-between px-6 py-4 transition-colors ${!n.read ? "bg-amber-50/40" : "hover:bg-surface-container-low"}`}>
              <div className="flex items-start gap-3">
                {/* Unread dot */}
                <div className="pt-2 shrink-0">
                  <span className={`h-2.5 w-2.5 rounded-full inline-block ${!n.read ? "bg-primary" : "bg-transparent"}`} />
                </div>
                <div>
                  <p className={`text-sm text-on-surface leading-relaxed ${!n.read ? "font-semibold" : ""}`}>
                    {n.text}
                  </p>
                  <span className="text-xs text-on-surface-variant font-mono mt-1 inline-block">
                    {new Date(n.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(n.id)}
                className="text-xs text-on-surface-variant hover:text-red-600 transition-colors font-semibold"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
