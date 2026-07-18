"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export interface Device {
  id: string;
  label: string;
  lastUsedAt: string | null;
  createdAt: string;
}

// Module-level cache so all hook instances stay in sync without a context provider.
let cachedDevices: Device[] = [];
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

async function fetchDevices() {
  try {
    const data = await api<{ devices: Device[] }>("/devices");
    cachedDevices = Array.isArray(data.devices) ? data.devices : [];
    notify();
  } catch {
    // silently ignore — keep stale data
  }
}

// Shared polling timer (single interval across all hook instances)
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let mountedCount = 0;
const POLL_INTERVAL_MS = 5_000;

/**
 * Returns real-time device list, a loading flag, and a manual refresh().
 * Automatically polls the backend every 5 s while any component is mounted.
 */
export function useDevices() {
  const [devices, setDevices] = useState<Device[]>(cachedDevices);
  const [loading, setLoading] = useState(cachedDevices.length === 0);
  const initialized = useRef(false);

  const sync = useCallback(() => {
    setDevices([...cachedDevices]);
    setLoading(false);
  }, []);

  // Subscribe to global updates
  useEffect(() => {
    subscribers.add(sync);
    mountedCount++;

    // Kick off polling when the first consumer mounts
    if (!pollingTimer) {
      pollingTimer = setInterval(fetchDevices, POLL_INTERVAL_MS);
    }

    // Initial fetch only once per mount
    if (!initialized.current) {
      initialized.current = true;
      fetchDevices().then(() => setLoading(false));
    } else {
      // Already have cache — apply immediately
      setDevices([...cachedDevices]);
      setLoading(false);
    }

    return () => {
      subscribers.delete(sync);
      mountedCount--;
      // Clear polling when no consumers remain
      if (mountedCount === 0 && pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    };
  }, [sync]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchDevices();
    setLoading(false);
  }, []);

  return { devices, loading, refresh };
}
