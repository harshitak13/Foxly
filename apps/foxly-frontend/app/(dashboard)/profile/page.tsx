"use client";
import { useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { AuthShell, Button, TextInput } from "@/components/ui";
import { api } from "@/lib/api";

export default function Profile() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [role, setRole] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<any>("/auth/me")
      .then((user) => {
        setName(user.name);
        setEmail(user.email);
        setCurrentEmail(user.email);
        setRole(user.role);
        setCreatedAt(new Date(user.createdAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }));
        setLoading(false);
      })
      .catch((err) => {
        setMessage({ type: "error", text: "Failed to load user profile: " + err.message });
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      let passkeyAssertion;
      if (email !== currentEmail) {
        const options = await api<any>("/auth/profile/options", { method: "POST" });
        passkeyAssertion = await startAuthentication(options);
      }

      await api("/auth/profile", {
        method: "POST",
        body: JSON.stringify({ name, email, passkeyAssertion }),
      });
      setMessage({ type: "success", text: "Profile details updated successfully!" });
      setCurrentEmail(email);
      // Update local storage email since it is used in passkey setups
      sessionStorage.setItem("foxly_email", email);
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-on-surface-variant">Loading profile settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-on-surface">Profile Settings</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Update your account details and review profile parameters.
        </p>
      </div>

      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm mb-6">
        {/* Profile Card Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-outline-variant mb-6">
          <div className="h-16 w-16 rounded-full bg-surface-container border border-outline-variant grid place-items-center text-3xl shadow-inner">
            👤
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">{name || "Foxly User"}</h2>
            <p className="text-xs text-on-surface-variant">{email}</p>
            <div className="flex gap-2 mt-1.5">
              <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Role: {role}
              </span>
              <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Joined: {createdAt}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-on-surface">Full name</label>
            <TextInput
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-on-surface">Email address</label>
            <TextInput
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {message && (
            <div
              className={`rounded-md p-3 text-sm ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-error"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="submit" disabled={saving} className="w-auto px-6">
              {saving ? "Saving changes..." : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
