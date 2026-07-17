import Link from "next/link";
import { AuthShell } from "@/components/ui";
export default function Success(){ return <AuthShell><h1 className="font-display text-4xl font-bold">You're protected</h1><p className="mt-3 text-on-surface-variant">Your passkey and backup codes are ready. Foxly can now approve sensitive actions with stronger assurance.</p><Link className="mt-6 grid h-12 place-items-center rounded bg-primary text-sm font-semibold text-white" href="/dashboard">Open dashboard</Link></AuthShell>; }
