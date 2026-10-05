import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { syncItem } from "@/lib/sync";

export const maxDuration = 300;

/** Called by the Connect widget after you authorize a bank: remember the item and import its data. */
export async function POST(req: Request) {
  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: string };
  if (!itemId || !/^[\w-]{8,64}$/.test(itemId)) return NextResponse.json({ error: "itemId inválido." }, { status: 400 });
  const db = await getDb();
  await db.query("INSERT INTO items (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [itemId]);
  try {
    const r = await syncItem(itemId, db);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Conectado, mas a importação falhou: ${(e as Error).message}` }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: string };
  if (!itemId) return NextResponse.json({ error: "itemId obrigatório." }, { status: 400 });
  const db = await getDb();
  await db.query("DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE item_id = $1)", [itemId]);
  await db.query("DELETE FROM bills WHERE account_id IN (SELECT id FROM accounts WHERE item_id = $1)", [itemId]);
  await db.query("DELETE FROM accounts WHERE item_id = $1", [itemId]);
  await db.query("DELETE FROM investments WHERE item_id = $1", [itemId]);
  await db.query("DELETE FROM items WHERE id = $1", [itemId]);
  return NextResponse.json({ ok: true });
}
