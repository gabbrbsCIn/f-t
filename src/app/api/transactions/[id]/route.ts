import { NextResponse } from "next/server";
import { recategorize } from "@/lib/actions";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { group_key?: string; sub_label?: string; rule?: boolean };
  try {
    const r = await recategorize(id, String(body.group_key ?? ""), String(body.sub_label ?? ""), body.rule !== false);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
