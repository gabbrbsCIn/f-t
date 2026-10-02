import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { pluggyConfigured } from "@/lib/pluggy";
import { syncAll } from "@/lib/sync";

export const maxDuration = 300;

/** Daily import, called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(got, `Bearer ${secret}`)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!pluggyConfigured()) return NextResponse.json({ skipped: "pluggy not configured" });
  return NextResponse.json(await syncAll());
}
