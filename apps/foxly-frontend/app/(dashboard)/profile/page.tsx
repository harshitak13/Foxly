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

  const [passkeyAssertion, setPasskeyAssertion] = useState<any>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailModalError, setEmailModalError] = useState("");
  const [emailModalSaving, setEmailModalSaving] = useState(false);

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

  const startEmailChangeFlow = async () => {
    setMessage(null);
    try {
      const options = await api<any>("/auth/profile/options", { method: "POST" });
      const assertion = await startAuthentication(options);
      setPasskeyAssertion(assertion);
      setNewEmail("");
      setEmailModalError("");
      setEmailModalOpen(true);
    } catch (err) {
      const msg = (err as Error).message;
      if (
        msg.toLowerCase().includes("not allowed") ||
        msg.toLowerCase().includes("cancelled") ||
        msg.toLowerCase().includes("abort") ||
        msg.toLowerCase().includes("timed out")
      ) {
        return; // user cancelled/dismissed biometric prompt
      }
      setMessage({ type: "error", text: msg });
    }
  };

  const handleEmailUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setEmailModalError("");
    setEmailModalSaving(true);
    try {
      await api("/auth/profile", {
        method: "POST",
        body: JSON.stringify({ name, email: newEmail.trim(), passkeyAssertion }),
      });
      setEmail(newEmail.trim());
      setCurrentEmail(newEmail.trim());
      // Update local storage email since it is used in passkey setups
      sessionStorage.setItem("foxly_email", newEmail.trim());
      setEmailModalOpen(false);
      setPasskeyAssertion(null);
      setMessage({ type: "success", text: "Email address updated successfully!" });
    } catch (err) {
      setEmailModalError((err as Error).message);
    } finally {
      setEmailModalSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await api("/auth/profile", {
        method: "POST",
        body: JSON.stringify({ name, email: currentEmail }),
      });
      setMessage({ type: "success", text: "Profile details updated successfully!" });
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
      {/* Email Change Modal */}
      {emailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setEmailModalOpen(false)}
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setEmailModalOpen(false)}
              className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface text-xl leading-none font-semibold"
            >
              ✕
            </button>
            <h2 className="font-bold text-on-surface text-lg mb-2">Change Email Address</h2>
            <p className="text-sm text-on-surface-variant mb-4">
              Enter your new email address below. You will use this new address to sign in next time.
            </p>
            <form onSubmit={handleEmailUpdateSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant">New Email Address</label>
                <TextInput
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@example.com"
                  autoFocus
                />
              </div>
              {emailModalError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-error">
                  {emailModalError}
                </div>
              )}
              <div className="flex gap-3 mt-5">
                <Button type="submit" disabled={emailModalSaving} className="flex-1">
                  {emailModalSaving ? "Updating..." : "Update Email"}
                </Button>
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="rounded-full border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <div className="flex gap-2 items-center">
              <TextInput
                required
                type="email"
                value={email}
                disabled
                className="bg-gray-50 text-gray-500 cursor-not-allowed flex-1"
                placeholder="you@example.com"
              />
              <button
                type="button"
                onClick={startEmailChangeFlow}
                className="shrink-0 h-12 rounded-lg border border-outline-variant px-4 bg-white text-sm font-semibold text-primary hover:bg-surface-container transition-colors"
              >
                🔑 Change Email
              </button>
            </div>
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
