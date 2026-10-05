import { NextResponse } from "next/server";
import { categoryOptions, createCategory, deleteCategory } from "@/lib/actions";

export async function GET() {
  return NextResponse.json({ options: await categoryOptions() });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { group_key?: string; label?: string };
  try {
    return NextResponse.json(await createCategory(String(b.group_key ?? ""), String(b.label ?? "")));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const u = new URL(req.url);
  return NextResponse.json(await deleteCategory(u.searchParams.get("group") ?? "", u.searchParams.get("label") ?? ""));
}
