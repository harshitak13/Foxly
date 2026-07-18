"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useDialog } from "@/components/dialog-provider";
const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/security", label: "Security" },
  { href: "/approvals", label: "Approvals" },
  { href: "/devices", label: "Devices" },
  { href: "/logs", label: "Logs" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const dialog = useDialog();

  const fetchStatus = () => {
    api<{ name: string; email: string; role: string }>("/auth/me")
      .then((u) => setUser(u))
      .catch(() => {});
    api<{ notifications: any[] }>("/notifications")
      .then((data) => {
        const notifications = Array.isArray(data.notifications) ? data.notifications : [];
        setUnreadCount(notifications.filter((n: any) => !n.read).length);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
    // Refresh status check every 8 seconds for notifications
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    setProfileDropdownOpen(false);
    if (await dialog.confirm({ message: "Are you sure you want to log out?", variant: "confirm" })) {
      try {
        await api("/auth/logout", { method: "POST" });
        router.push("/sign-in");
      } catch (err) {
        dialog.alert({ message: "Logout failed: " + (err as Error).message, variant: "error" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-outline-variant bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 mr-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white text-lg font-bold">
              🦊
            </div>
            <span className="font-display text-xl font-bold text-on-surface">Foxly</span>
          </Link>

          {/* Trust badge */}
          <span className="flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold text-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
            Trust Level: High
          </span>

          {/* Nav links */}
          <nav className="flex items-center gap-1 ml-2">
            {NAV.map(({ href, label }) => {
              const active = pathname === href || (href === "/devices" && pathname.startsWith("/devices/"));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 relative">
            <Link
              href="/devices/new"
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-container transition-colors"
            >
              + Add Device
            </Link>

            {/* Notification Bell */}
            <Link
              href="/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white grid place-items-center font-bold">
                  {unreadCount}
                </span>
              )}
            </Link>

            {/* Avatar Dropdown Trigger */}
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="relative flex items-center gap-1.5 rounded-full focus:outline-none"
            >
              <div className="grid h-9 w-9 place-items-center rounded-full bg-surface-container border border-outline-variant overflow-hidden hover:bg-surface-container-high transition-colors">
                <span className="text-lg">👤</span>
              </div>
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setProfileDropdownOpen(false)}
                />
                <div className="absolute right-0 top-11 z-20 w-56 rounded-xl border border-outline-variant bg-white p-2 shadow-lg auth-card-shadow">
                  {user && (
                    <div className="px-3 py-2 border-b border-outline-variant mb-1">
                      <p className="text-sm font-bold text-on-surface truncate">{user.name}</p>
                      <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                      <span className="mt-1 inline-block rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                        {user.role}
                      </span>
                    </div>
                  )}
                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-on-surface hover:bg-surface-container text-left transition-colors"
                  >
                    👤 Profile Settings
                  </Link>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left transition-colors font-semibold"
                  >
                    🚪 Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
