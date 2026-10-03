import { NextResponse } from "next/server";
import { chat, conversations, currentConversation, deleteConversation, history, validConversationId } from "@/lib/ai/chat";
import { OllamaError } from "@/lib/ai/ollama";

export const maxDuration = 120;

export async function GET(req: Request) {
  const c = new URL(req.url).searchParams.get("c");
  const conversation = validConversationId(c) ? c : await currentConversation();
  const [messages, list] = await Promise.all([history(conversation), conversations()]);
  return NextResponse.json({ conversation, messages, conversations: list });
}

export async function DELETE(req: Request) {
  const c = new URL(req.url).searchParams.get("c");
  if (!validConversationId(c)) return NextResponse.json({ error: "Conversa inválida." }, { status: 400 });
  await deleteConversation(c);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { message?: string; conversation?: string };
  const text = (body.message ?? "").trim();
  if (!text) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Mensagem longa demais." }, { status: 400 });
  const conversation = validConversationId(body.conversation) ? body.conversation : await currentConversation();
  try {
    return NextResponse.json({ ...(await chat(text, conversation)), conversation });
  } catch (e) {
    if (e instanceof OllamaError) {
      if (e.status === 401 || e.status === 403) return NextResponse.json({ error: "A chave do Ollama não está configurada ou é inválida (OLLAMA_API_KEY)." }, { status: 503 });
      if (e.status === 404) return NextResponse.json({ error: `O modelo ${process.env.OLLAMA_MODEL || "gpt-oss:120b"} não foi encontrado no Ollama (OLLAMA_MODEL).` }, { status: 503 });
      if (e.status === 429) return NextResponse.json({ error: "Limite de uso do Ollama atingido. Tenta de novo em alguns minutos." }, { status: 429 });
      return NextResponse.json({ error: `O Ollama respondeu com erro (${e.status}). Tenta de novo.` }, { status: 502 });
    }
    if ((e as Error).name === "TimeoutError") return NextResponse.json({ error: "O modelo demorou demais para responder. Tenta de novo." }, { status: 504 });
    console.error("chat", e);
    return NextResponse.json({ error: "Não consegui responder agora. Tenta de novo." }, { status: 500 });
  }
}
