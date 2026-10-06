export function apiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  if (typeof window === "undefined") return "http://localhost:4000";
  return "";
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isRelative = path.startsWith("/");
  let url: string;

  if (process.env.NEXT_PUBLIC_API_BASE) {
    const base = process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "");
    url = isRelative ? `${base}${path}` : path;
  } else {
    const requestUrl = isRelative ? `/api-proxy${path}` : path;
    url = `${apiBase()}${requestUrl}`;
  }

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Stable-Client-Id": stableClientId(),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") {
    const p = window.location.pathname;
    if (!p.startsWith("/sign-in") && !p.startsWith("/sign-up")) {
      window.location.href = "/sign-in";
    }
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export function stableClientId() {
  if (typeof window === "undefined") return "server";
  const key = "foxly_stable_client_id";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}
