import { today } from "../dates";
import { getDb } from "../db";
import { ollamaChat, type OllamaMessage } from "./ollama";
import { CATEGORY_HELP, MUTATING, TOOLS, runTool } from "./tools";

const MAX_STEPS = 8;
const HISTORY_LIMIT = 40;

function systemPrompt(day: string) {
  const name = process.env.USER_NAME ?? "Gabriel";
  return `Você é o liu liu, o assistente financeiro pessoal de ${name}. Hoje é ${day} (fuso de São Paulo).

Você lê as contas e cartões dele, conectados pelo Open Finance, e conversa em português do Brasil, de um jeito direto e caloroso, como um amigo que entende de dinheiro.

Como responder:
- Use as ferramentas para buscar números antes de afirmar qualquer valor. Nunca invente valores, datas ou lojas.
- Respostas curtas: uma ou duas frases com o número principal, e só depois detalhes se ajudarem. Valores sempre como R$ 1.234,56.
- Quando ele contar um gasto ("almoço 42 no débito", "paguei 38 de estacionamento em dinheiro"), registre com registrar_gasto e confirme em uma linha com valor, categoria e data. Gastos feitos no cartão ou na conta já chegam sozinhos pelo banco: avise isso em vez de registrar em dobro, a menos que ele insista.
- Se ele corrigir uma categoria, use recategorizar com aplicar_nas_parecidas = true, a não ser que ele diga que é só aquela.
- Pode usar **negrito** para o número principal e listas curtas com "- ". Sem tabelas e sem títulos.
- Dê opinião quando ajudar (ex.: "delivery subiu bastante, vale ficar de olho"), sem sermão.
- Se não houver dados (nenhum banco conectado ainda), diga isso e sugira conectar pelo botão "+ conectar banco".

Categorias: ${CATEGORY_HELP}. "transfer" marca movimentação entre contas dele (não conta como gasto).`;
}

export type ChatRow = { id: number; role: "user" | "assistant"; display: string; created_at: string };

export type ConversationSummary = { id: string; title: string; updated_at: string; messages: number };

export function newConversationId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function validConversationId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{6,40}$/.test(id);
}

/** Past conversations, newest first, titled by their first question. */
export async function conversations(limit = 30): Promise<ConversationSummary[]> {
  const db = await getDb();
  return db.query<ConversationSummary>(
    `SELECT conversation AS id,
            COALESCE((SELECT display FROM chat_messages f WHERE f.conversation = m.conversation AND f.role = 'user' AND f.display IS NOT NULL ORDER BY f.id LIMIT 1), 'Conversa') AS title,
            max(created_at) AS updated_at,
            count(*) FILTER (WHERE display IS NOT NULL)::int AS messages
     FROM chat_messages m GROUP BY conversation ORDER BY max(id) DESC LIMIT $1`,
    [limit],
  );
}

/** The conversation to open by default: the latest one if it had activity today, otherwise a new one. */
export async function currentConversation(): Promise<string> {
  const [latest] = await conversations(1);
  if (latest && latest.updated_at.slice(0, 10) >= today()) return latest.id;
  return newConversationId();
}

export async function history(conversation: string): Promise<ChatRow[]> {
  const db = await getDb();
  return db.query<ChatRow>("SELECT id, role, display, created_at FROM chat_messages WHERE conversation = $1 AND display IS NOT NULL ORDER BY id", [conversation]);
}

export async function deleteConversation(conversation: string) {
  const db = await getDb();
  await db.query("DELETE FROM chat_messages WHERE conversation = $1", [conversation]);
}

function parseArgs(a: Record<string, unknown> | string): unknown {
  if (typeof a !== "string") return a;
  try {
    return JSON.parse(a);
  } catch {
    return {};
  }
}

/** One user turn in a conversation; tool calls and results are stored so follow-ups have context. */
export async function chat(text: string, conversation: string): Promise<{ reply: string; changed: boolean }> {
  const db = await getDb();
  const rows = await db.query<{ content: string }>("SELECT content FROM chat_messages WHERE conversation = $1 ORDER BY id", [conversation]);
  let past: OllamaMessage[] = rows.map((r) => JSON.parse(r.content));
  // Keep the prompt small: start the window at a user message so tool results never lose their call.
  if (past.length > HISTORY_LIMIT) {
    past = past.slice(-HISTORY_LIMIT);
    const firstUser = past.findIndex((m) => m.role === "user");
    past = firstUser >= 0 ? past.slice(firstUser) : [];
  }
  const messages: OllamaMessage[] = [{ role: "system", content: systemPrompt(today()) }, ...past];
  const insertedIds: number[] = [];

  const save = async (m: OllamaMessage, display: string | null) => {
    const { thinking: _drop, ...clean } = m;
    const r = await db.query<{ id: number }>("INSERT INTO chat_messages (conversation, role, content, display) VALUES ($1,$2,$3,$4) RETURNING id", [conversation, m.role, JSON.stringify(clean), display]);
    insertedIds.push(r[0].id);
    messages.push(clean);
  };

  let changed = false;
  try {
    await save({ role: "user", content: text }, text);
    for (let step = 0; step < MAX_STEPS; step++) {
      const msg = await ollamaChat(messages, TOOLS);
      const calls = msg.tool_calls ?? [];
      if (calls.length) {
        await save({ role: "assistant", content: msg.content ?? "", tool_calls: calls }, null);
        for (const c of calls) {
          const r = await runTool(c.function.name, parseArgs(c.function.arguments));
          if (r.ok && MUTATING.has(c.function.name)) changed = true;
          await save({ role: "tool", tool_name: c.function.name, content: r.content }, null);
        }
        continue;
      }
      const reply = (msg.content ?? "").trim() || "Pronto.";
      await save({ role: "assistant", content: reply }, reply);
      return { reply, changed };
    }
    // Ran out of steps mid-task: drop the unfinished turn rather than leave it half-stored.
    await db.query("DELETE FROM chat_messages WHERE id = ANY($1::int[])", [insertedIds]);
    return { reply: "Essa pergunta precisou de passos demais. Tenta perguntar de um jeito mais específico?", changed };
  } catch (e) {
    if (insertedIds.length) await db.query("DELETE FROM chat_messages WHERE id = ANY($1::int[])", [insertedIds]);
    throw e;
  }
}
