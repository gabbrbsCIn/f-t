import { NextResponse } from "next/server";
import { chat, history } from "@/lib/ai/chat";
import { OllamaError } from "@/lib/ai/ollama";

export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({ messages: await history() });
}

export async function POST(req: Request) {
  const { message } = (await req.json().catch(() => ({}))) as { message?: string };
  const text = (message ?? "").trim();
  if (!text) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Mensagem longa demais." }, { status: 400 });
  try {
    return NextResponse.json(await chat(text));
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
