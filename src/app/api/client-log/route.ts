import { NextResponse } from "next/server";

/** Records what happened in the browser during the bank connection, so it shows up in the Vercel logs. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { step?: string; detail?: string };
  const step = String(body.step ?? "?").slice(0, 40);
  const detail = String(body.detail ?? "").slice(0, 300);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 160);
  console.log(`[connect] ${step}${detail ? ` · ${detail}` : ""} · ${ua}`);
  return NextResponse.json({ ok: true });
}
