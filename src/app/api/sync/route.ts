import { NextResponse } from "next/server";
import { pluggyConfigured } from "@/lib/pluggy";
import { syncAll } from "@/lib/sync";

export const maxDuration = 300;

export async function POST() {
  if (!pluggyConfigured()) return NextResponse.json({ error: "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET." }, { status: 503 });
  return NextResponse.json(await syncAll());
}
