import Link from "next/link";
import { DeviceLinkInvite } from "@/components/device-link-invite";
import { AuthShell } from "@/components/ui";

export default function Success() {
  return (
    <AuthShell>
      <h1 className="font-display text-4xl font-bold">You're protected</h1>
      <p className="mt-3 text-on-surface-variant">
        Your passkey and backup codes are ready. Add a second device now so you can still sign in if this device is unavailable.
      </p>
      <DeviceLinkInvite />
      <Link className="mt-6 grid h-12 place-items-center rounded bg-primary text-sm font-semibold text-white" href="/dashboard">
        Open dashboard
      </Link>
    </AuthShell>
  );
}
