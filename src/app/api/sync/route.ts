import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pluggyConfigured } from "@/lib/pluggy";
import { requestRefresh, syncAll } from "@/lib/sync";

export const maxDuration = 300;

/** Asks the banks for fresh data where Pluggy allows it, then imports what Pluggy already has. */
export async function POST() {
  if (!pluggyConfigured()) return NextResponse.json({ error: "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET." }, { status: 503 });
  const refresh = await requestRefresh(await getDb());
  const result = await syncAll();
  const db = await getDb();
  const [row] = await db.query<{ next: string | null }>("SELECT min(next_auto_sync_at) AS next FROM items");
  return NextResponse.json({ ...result, refresh, nextAuto: row?.next ?? null });
}
