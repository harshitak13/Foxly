"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export interface ActivityItem {
  id: string;
  action: string;
  label: string;
  icon: string;
  category: string;
  device: string | null;
  createdAt: string;
}

// Module-level cache shared across all hook instances
let cachedActivity: ActivityItem[] = [];
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

async function fetchActivity() {
  try {
    const data = await api<{ activity: ActivityItem[] }>("/activity");
    cachedActivity = Array.isArray(data.activity) ? data.activity : [];
    notify();
  } catch {
    // silently ignore — keep stale data
  }
}

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let mountedCount = 0;
const POLL_INTERVAL_MS = 10_000; // 10 s — activity changes less often than devices

/**
 * Returns the real-time activity feed from the /activity endpoint.
 * Polls every 10 s while any component is mounted.
 * Exposes refresh() for an immediate refetch.
 */
export function useActivity() {
  const [activity, setActivity] = useState<ActivityItem[]>(cachedActivity);
  const [loading, setLoading] = useState(cachedActivity.length === 0);
  const initialized = useRef(false);

  const sync = useCallback(() => {
    setActivity([...cachedActivity]);
    setLoading(false);
  }, []);

  useEffect(() => {
    subscribers.add(sync);
    mountedCount++;

    if (!pollingTimer) {
      pollingTimer = setInterval(fetchActivity, POLL_INTERVAL_MS);
    }

    if (!initialized.current) {
      initialized.current = true;
      fetchActivity().then(() => setLoading(false));
    } else {
      setActivity([...cachedActivity]);
      setLoading(false);
    }

    return () => {
      subscribers.delete(sync);
      mountedCount--;
      if (mountedCount === 0 && pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    };
  }, [sync]);

  const refresh = useCallback(async () => {
    await fetchActivity();
  }, []);

  return { activity, loading, refresh };
}
