import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Foxly", description: "Passkey authentication platform" };
import { DialogProvider } from "@/components/dialog-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><DialogProvider>{children}</DialogProvider></body></html>; }
