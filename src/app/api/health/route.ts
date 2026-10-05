import { NextResponse } from "next/server";
import { health } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await health();
  return NextResponse.json(h, { status: h.ok ? 200 : 503 });
}
