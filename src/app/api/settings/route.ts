import { NextResponse } from "next/server";
import { setSetting } from "@/lib/queries";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { savings_goal?: number };
  const v = Number(body.savings_goal);
  if (!Number.isFinite(v) || v < 0 || v > 10_000_000) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  await setSetting("savings_goal", String(Math.round(v * 100) / 100));
  return NextResponse.json({ ok: true });
}
