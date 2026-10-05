import { z } from "zod";
import type { OllamaTool } from "./ollama";
import { addManualTransaction, createGoal, deleteManualTransaction, recategorize, setBudget, setSavingsGoal, updateGoal } from "../actions";
import { GROUPS, group } from "../categories";
import { monthStart, today, validYm, ymOf } from "../dates";
import { getDb } from "../db";
import { normalize } from "../categorize";
import { txHref } from "../txFilter";
import { accounts, cardsView, installmentsView, investmentsView, overview, txsBetween } from "../queries";

const GROUP_ENUM = ["moradia", "alim", "compras", "saude", "lazer", "transp", "outros"] as const;
const ymSchema = z.string().regex(/^\d{4}-\d{2}$/).describe("Mês no formato AAAA-MM. Omita para o mês atual.");
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type ToolDef<S extends z.ZodType> = { name: string; description: string; schema: S; run: (input: z.infer<S>) => Promise<unknown> };
const def = <S extends z.ZodType>(d: ToolDef<S>) => d;

const round = (v: number) => Math.round(v * 100) / 100;

export const TOOL_DEFS = [
  def({
    name: "resumo_do_mes",
    description:
      "Resumo de um mês: total gasto, entradas, comparação com o mesmo ponto do mês anterior, gasto por categoria, quanto pode gastar por dia e próximos vencimentos. Use para perguntas gerais sobre como está o mês.",
    schema: z.object({ mes: ymSchema.optional() }),
    run: async ({ mes }) => {
      const ym = validYm(mes) ?? ymOf(today());
      const o = await overview(ym);
      return {
        mes: ym,
        dia_atual: o.isCurrent ? o.day : null,
        gasto: o.spent,
        entradas: o.income,
        gasto_mes_anterior_mesmo_dia: o.prevSpentSamePoint,
        categorias: o.groups.filter((g) => g.total > 0 || g.prev > 0).map((g) => ({ categoria: g.key, nome: group(g.key).name, total: g.total, mes_anterior: g.prev, subcategorias: g.subs.slice(0, 6) })),
        pode_gastar: { por_dia: o.spend.perDay, livre_no_mes: o.spend.free, renda_considerada: o.spend.income, meta_de_poupanca: o.savingsGoal, dias_restantes: o.spend.daysLeft },
        proximos_vencimentos: o.upcoming,
        maior_gasto: o.biggest && { descricao: o.biggest.description, valor: o.biggest.amount, data: o.biggest.date },
      };
    },
  }),
  def({
    name: "buscar_transacoes",
    description:
      "Busca transações por texto (loja, descrição), categoria, período e tipo. Retorna até `limite` itens e o total somado. Use para perguntas como 'quanto gastei com iFood' ou 'quais foram minhas compras na Amazon'.",
    schema: z.object({
      texto: z.string().optional().describe("Parte da descrição, ex.: 'ifood', 'uber'."),
      categoria: z.enum(GROUP_ENUM).optional(),
      subcategoria: z.string().optional().describe("Ex.: 'Delivery', 'Supermercado'."),
      de: daySchema.optional().describe("Data inicial AAAA-MM-DD. Padrão: início do mês atual."),
      ate: daySchema.optional().describe("Data final AAAA-MM-DD. Padrão: hoje."),
      tipo: z.enum(["saida", "entrada", "todas"]).optional(),
      limite: z.number().int().min(1).max(100).optional(),
    }),
    run: async (i) => {
      const from = i.de ?? monthStart(ymOf(today()));
      const to = i.ate ?? today();
      const q = i.texto ? normalize(i.texto) : null;
      const sub = i.subcategoria ? normalize(i.subcategoria) : null;
      const all = (await txsBetween(from, to)).filter(
        (t) =>
          (!q || normalize(t.description).includes(q)) &&
          (!i.categoria || t.group_key === i.categoria) &&
          (!sub || normalize(t.sub_label).includes(sub)) &&
          (i.tipo === "todas" || (i.tipo === "entrada" ? t.direction === "in" : t.direction === "out")) &&
          !t.excluded,
      );
      const subs = [...new Set(all.map((t) => `${t.group_key}:${t.sub_label}`))];
      const cats = sub && subs.length === 1 ? subs : i.categoria ? [i.categoria] : [];
      return {
        periodo: { de: from, ate: to },
        link: txHref({ from, to, cats, q: i.texto ?? "", kind: i.tipo === "entrada" ? "in" : i.tipo === "todas" ? "all" : "out" }),
        quantidade: all.length,
        total: round(all.reduce((s, t) => s + t.amount, 0)),
        transacoes: all.slice(0, i.limite ?? 30).map((t) => ({ id: t.id, data: t.date, descricao: t.description, valor: t.amount, tipo: t.direction === "in" ? "entrada" : "saida", categoria: t.group_key, subcategoria: t.sub_label, parcela: t.total_installments ? `${t.installment_number}/${t.total_installments}` : undefined })),
      };
    },
  }),
  def({
    name: "registrar_gasto",
    description:
      "Registra um gasto (ou entrada) que não passou pelo banco, como dinheiro vivo. Se não souber a categoria, omita que o app escolhe pela descrição.",
    schema: z.object({
      descricao: z.string().min(1).max(120),
      valor: z.number().positive(),
      data: daySchema.optional().describe("Padrão: hoje."),
      categoria: z.enum(GROUP_ENUM).optional(),
      subcategoria: z.string().max(60).optional(),
      tipo: z.enum(["saida", "entrada"]).optional(),
    }),
    run: async (i) =>
      addManualTransaction({ description: i.descricao, amount: i.valor, date: i.data, group_key: i.categoria, sub_label: i.subcategoria, direction: i.tipo === "entrada" ? "in" : "out" }),
  }),
  def({
    name: "desfazer_registro",
    description: "Apaga um gasto registrado na conversa (só funciona para os registrados manualmente).",
    schema: z.object({ id: z.string() }),
    run: async ({ id }) => deleteManualTransaction(id),
  }),
  def({
    name: "recategorizar",
    description:
      "Muda a categoria de uma transação. Com aplicar_nas_parecidas, as transações com a mesma descrição (passadas e futuras) também mudam. Use 'transfer' como categoria para tirar uma movimentação entre suas próprias contas dos gastos.",
    schema: z.object({
      id: z.string(),
      categoria: z.enum([...GROUP_ENUM, "transfer"]),
      subcategoria: z.string().min(1).max(60),
      aplicar_nas_parecidas: z.boolean(),
    }),
    run: async (i) => recategorize(i.id, i.categoria, i.subcategoria, i.aplicar_nas_parecidas),
  }),
  def({
    name: "listar_metas",
    description: "Lista as metas de economia com quanto já foi guardado.",
    schema: z.object({}),
    run: async () => (await getDb()).query("SELECT id, name AS nome, target AS valor_alvo, saved AS guardado, deadline AS prazo FROM goals ORDER BY created_at"),
  }),
  def({
    name: "criar_meta",
    description: "Cria uma meta de economia.",
    schema: z.object({ nome: z.string().min(1).max(80), valor_alvo: z.number().positive(), prazo: daySchema.optional(), ja_guardado: z.number().min(0).optional() }),
    run: async (i) => createGoal({ name: i.nome, target: i.valor_alvo, saved: i.ja_guardado, deadline: i.prazo ?? null }),
  }),
  def({
    name: "atualizar_meta",
    description: "Atualiza quanto já foi guardado numa meta ou o valor alvo.",
    schema: z.object({ id: z.number().int(), guardado: z.number().min(0).optional(), valor_alvo: z.number().positive().optional() }),
    run: async (i) => updateGoal(i.id, { saved: i.guardado, target: i.valor_alvo }),
  }),
  def({
    name: "definir_orcamento",
    description: "Define o orçamento mensal de uma categoria.",
    schema: z.object({ categoria: z.enum(GROUP_ENUM), valor: z.number().min(0) }),
    run: async (i) => setBudget(i.categoria, i.valor),
  }),
  def({
    name: "definir_meta_de_poupanca",
    description: "Define quanto a pessoa quer guardar por mês. Entra no cálculo de 'pode gastar hoje'.",
    schema: z.object({ valor: z.number().min(0) }),
    run: async (i) => setSavingsGoal(i.valor),
  }),
  def({
    name: "parcelamentos",
    description: "Compras parceladas ativas e quanto já está comprometido nos próximos meses.",
    schema: z.object({}),
    run: async () => {
      const v = await installmentsView(ymOf(today()));
      return {
        este_mes: v.thisMonth,
        ainda_a_pagar: v.stillToPay,
        compras: v.plans.map((p) => ({ descricao: p.description, parcela: `${p.current}/${p.total}`, valor: p.value, termina: p.endYm })),
        comprometido_por_mes: v.committed.map((c) => ({ mes: c.ym, total: c.total })),
      };
    },
  }),
  def({
    name: "investimentos",
    description: "Investimentos: total líquido, quanto foi aplicado e rendeu, divisão por classe (CDB, Tesouro, ações), aplicações agrupadas com taxa e vencimentos por ano.",
    schema: z.object({}),
    run: async () => {
      const v = await investmentsView();
      return {
        total_liquido: v.total,
        total_bruto: v.gross,
        aplicado_conhecido: v.investedKnown,
        rendimento_conhecido: v.profitKnown,
        por_classe: v.byClass.map((c) => ({ classe: c.name, total: c.total })),
        aplicacoes: v.groups.map((g) => ({ nome: g.label, taxa: g.rate, quantidade: g.items.length, hoje: g.balance, aplicado: g.invested, proximo_vencimento: g.nextDue })),
        vencimentos_por_ano: v.maturities,
        sem_vencimento: v.noDue,
      };
    },
  }),
  def({
    name: "contas_e_cartoes",
    description: "Saldos das contas, limites e faturas dos cartões (com fechamento e vencimento).",
    schema: z.object({}),
    run: async () => {
      const [accs, cards] = await Promise.all([accounts(), cardsView()]);
      return {
        contas: accs.filter((a) => a.type === "BANK").map((a) => ({ banco: a.institution, nome: a.name, saldo: a.balance })),
        cartoes: cards.map(({ card: c, bills, nextCommitted }) => ({
          banco: c.institution,
          nome: c.name,
          final: c.number?.slice(-4),
          fatura_atual: Math.abs(c.balance),
          limite: c.credit_limit,
          disponivel: c.available_limit,
          fecha: c.close_date,
          vence: c.due_date,
          faturas_anteriores: bills.map((b) => ({ vencimento: b.due_date, valor: b.total_amount })),
          parcelas_ja_no_proximo_mes: nextCommitted?.total ?? 0,
        })),
      };
    },
  }),
];

export const TOOLS: OllamaTool[] = TOOL_DEFS.map((t) => {
  const { $schema: _ignored, ...parameters } = z.toJSONSchema(t.schema) as Record<string, unknown>;
  return { type: "function", function: { name: t.name, description: t.description, parameters } };
});

/** Tools that change data, so the UI knows to refresh after the reply. */
export const MUTATING = new Set(["registrar_gasto", "desfazer_registro", "recategorizar", "criar_meta", "atualizar_meta", "definir_orcamento", "definir_meta_de_poupanca"]);

export async function runTool(name: string, input: unknown): Promise<{ ok: boolean; content: string }> {
  const tool = TOOL_DEFS.find((t) => t.name === name);
  if (!tool) return { ok: false, content: `Ferramenta desconhecida: ${name}` };
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) return { ok: false, content: `Parâmetros inválidos: ${parsed.error.message}` };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await tool.run(parsed.data as any);
    return { ok: true, content: JSON.stringify(result) };
  } catch (e) {
    return { ok: false, content: `Erro: ${(e as Error).message}` };
  }
}

export const CATEGORY_HELP = GROUPS.map((g) => `${g.key} = ${g.name}`).join("; ");
