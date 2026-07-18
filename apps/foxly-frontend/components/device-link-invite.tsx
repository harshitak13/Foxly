"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type LinkStatus = "pending" | "scanned" | "completed" | "expired";

interface DeviceLinkSession {
  sessionId: string;
  url: string;
  status: LinkStatus;
  expiresAt: string;
}

export function DeviceLinkInvite() {
  const [session, setSession] = useState<DeviceLinkSession | null>(null);
  const [status, setStatus] = useState<LinkStatus>("pending");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createSession() {
    setBusy(true);
    setError("");
    try {
      const next = await api<DeviceLinkSession>("/api/device-link/create", { method: "POST" });
      setSession(next);
      setStatus(next.status);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    createSession();
  }, []);

  useEffect(() => {
    if (!session || status === "completed" || status === "expired") return;
    const interval = window.setInterval(async () => {
      try {
        const data = await api<{ status: LinkStatus; expiresAt: string }>(`/api/device-link/${session.sessionId}/status`);
        setStatus(data.status);
      } catch (err) {
        setError((err as Error).message);
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [session, status]);

  const qrSrc = useMemo(() => {
    if (!session) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(session.url)}`;
  }, [session]);

  const copy =
    status === "completed"
      ? "Backup device registered."
      : status === "scanned"
        ? "Device connected. Complete setup on your other device."
        : status === "expired"
          ? "QR expired. Generate a new one."
          : "Waiting for scan...";

  return (
    <section className="mt-6 rounded-lg border border-outline-variant bg-surface-container-low p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-on-surface">Add a backup device</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Scan this QR on a phone, tablet, or second laptop to register another passkey for recovery.
          </p>
        </div>
        <button
          type="button"
          onClick={createSession}
          disabled={busy}
          aria-label="Generate new QR code"
          title="Generate new QR code"
          className="grid h-10 w-10 shrink-0 place-items-center rounded border border-outline-variant bg-white text-primary disabled:opacity-50"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {session && status !== "completed" && (
        <>
          <div className="mt-4 grid place-items-center rounded-md bg-white p-4">
            <img src={qrSrc} alt="QR code for backup device registration" width={240} height={240} className="h-60 w-60" />
          </div>
          <p className="mt-2 break-all text-xs text-on-surface-variant">{session.url}</p>
          {session.url.includes("localhost") && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              This QR points to localhost. Open Foxly through your tunnel or LAN HTTPS URL, then refresh this QR.
            </p>
          )}
        </>
      )}

      <p className={`mt-3 text-sm font-semibold ${status === "completed" ? "text-green-700" : "text-on-surface"}`}>
        {copy}
      </p>
      {status === "expired" && (
        <button type="button" onClick={createSession} className="mt-3 text-sm font-semibold text-primary underline underline-offset-2">
          Refresh QR code
        </button>
      )}
      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </section>
  );
}
