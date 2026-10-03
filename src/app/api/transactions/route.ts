import { NextResponse } from "next/server";
import { addManualTransaction, updateTransaction } from "@/lib/actions";

/** A transaction you add by hand (cash, a Pix from an unconnected bank…). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { description?: string; amount?: number; date?: string; direction?: "in" | "out"; group_key?: string; sub_label?: string; note?: string };
  const amount = Number(b.amount);
  if (!b.description?.trim()) return NextResponse.json({ error: "Dê um nome para a transação." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  const tx = await addManualTransaction({ description: b.description.trim(), amount, date: b.date, direction: b.direction === "in" ? "in" : "out", group_key: b.group_key, sub_label: b.sub_label, source: "manual" });
  if (b.note) await updateTransaction(tx.id, { note: b.note });
  return NextResponse.json(tx);
}
