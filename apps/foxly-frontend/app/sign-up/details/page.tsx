"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, Button, TextInput } from "@/components/ui";
import { api } from "@/lib/api";
export default function SignUpDetails() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/auth/signup/init", {
        method: "POST",
        body: JSON.stringify({ name, email }),
      });
      sessionStorage.setItem("foxly_email", email);
      router.push("/sign-up/passkey-setup");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AuthShell navLabel="Sign in" navHref="/sign-in">
      <h1 className="font-display text-4xl font-bold leading-tight">
        Create your secure Foxly account
      </h1>
      <p className="mt-3 text-on-surface-variant">
        Start with your details, then enroll a passkey and recovery codes.
      </p>
      <form onSubmit={submit} className="mt-6">
        <label className="text-sm font-semibold">
          Full name
          <TextInput
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Email
          <TextInput
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {error && <p className="mt-4 text-sm text-error">{error}</p>}
        <Button type="submit">Continue</Button>
      </form>
    </AuthShell>
  );
}
