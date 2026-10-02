// Minimal client for Ollama's chat API (https://ollama.com or a self-hosted server).

export type OllamaToolCall = { function: { name: string; arguments: Record<string, unknown> | string } };
export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
  thinking?: string;
};
export type OllamaTool = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export class OllamaError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const ollamaModel = () => process.env.OLLAMA_MODEL || "gpt-oss:120b";

export async function ollamaChat(messages: OllamaMessage[], tools: OllamaTool[]): Promise<OllamaMessage> {
  const host = (process.env.OLLAMA_HOST || "https://ollama.com").replace(/\/$/, "");
  const key = process.env.OLLAMA_API_KEY;
  if (!key && host.includes("ollama.com")) throw new OllamaError(401, "OLLAMA_API_KEY não configurada.");

  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model: ollamaModel(), messages, tools, stream: false, options: { temperature: 0.3 } }),
    signal: AbortSignal.timeout(110_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = body;
    try {
      msg = JSON.parse(body).error ?? body;
    } catch {}
    throw new OllamaError(res.status, msg.slice(0, 300));
  }
  const data = (await res.json()) as { message?: OllamaMessage };
  if (!data.message) throw new OllamaError(502, "Resposta vazia do Ollama.");
  return data.message;
}
