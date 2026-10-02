import Link from "next/link";
import { Suspense } from "react";
import { ChatDrawer } from "@/components/ChatDrawer";
import { ConnectBank } from "@/components/ConnectBank";
import { Nav } from "@/components/Nav";
import { SyncButton } from "@/components/SyncButton";
import { Wordmark } from "@/components/Wordmark";
import { pluggyConfigured } from "@/lib/pluggy";
import { lastSync } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const synced = await lastSync();
  const initials = (process.env.USER_NAME ?? "Gabriel").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="app">
      <header className="top">
        <Link href="/" aria-label="liu liu, visão geral">
          <Wordmark />
        </Link>
        <Suspense><Nav /></Suspense>
        <div className="right">
          <SyncButton last={synced} configured={pluggyConfigured()} />
          <span className="avatar" aria-hidden="true">{initials}</span>
        </div>
      </header>
      <main className="main">{children}</main>
      <ChatDrawer />
      <ConnectBank />
    </div>
  );
}
