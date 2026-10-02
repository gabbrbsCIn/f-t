import { after, NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { syncItem } from "@/lib/sync";

export const maxDuration = 300;

const SYNC_EVENTS = new Set(["item/created", "item/updated", "item/login_succeeded", "transactions/created", "transactions/updated", "transactions/deleted"]);

/** Pluggy calls this when an item finishes updating. We answer right away and import in the background. */
export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret") ?? "";
  const expected = process.env.WEBHOOK_SECRET ?? "";
  if (!expected || !safeEqual(secret, expected)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { event?: string; itemId?: string };
  if (body.itemId && body.event && SYNC_EVENTS.has(body.event)) {
    const itemId = body.itemId;
    after(async () => {
      const db = await getDb();
      const known = await db.query("SELECT 1 FROM items WHERE id = $1", [itemId]);
      if (known.length) await syncItem(itemId, db).catch((e) => console.error("webhook sync", itemId, e));
    });
  }
  return NextResponse.json({ ok: true });
}
