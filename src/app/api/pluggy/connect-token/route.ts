import { NextResponse } from "next/server";
import { pluggy, pluggyConfigured, webhookUrl } from "@/lib/pluggy";

export async function POST(req: Request) {
  if (!pluggyConfigured()) return NextResponse.json({ error: "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET." }, { status: 503 });
  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: string };
  try {
    const { accessToken } = await pluggy().createConnectToken(itemId, { webhookUrl: webhookUrl(), clientUserId: "liuliu", avoidDuplicates: true });
    return NextResponse.json({ accessToken });
  } catch (e) {
    return NextResponse.json({ error: `A Pluggy recusou o pedido: ${(e as Error).message}` }, { status: 502 });
  }
}
