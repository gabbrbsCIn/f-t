import { addMonths, monthName, type Ym } from "./dates";
import { BRL } from "./format";
import type { overview } from "./queries";
import type { Tx } from "./finance";
import { isSpend } from "./finance";

type Overview = Awaited<ReturnType<typeof overview>>;
export type Note = { text: string; ask: string };

/** The three notes on the home card. Plain rules over your data, so the page loads without calling the AI. */
export function notes(o: Overview, txs: Tx[], prevTxs: Tx[]): Note[] {
  const out: Note[] = [];
  const prevName = monthName(addMonths(o.ym, -1));

  // Subcategory that grew the most against last month.
  const subs = (list: Tx[], upTo: number) => {
    const m = new Map<string, number>();
    for (const t of list) if (isSpend(t) && Number(t.date.slice(8, 10)) <= upTo) m.set(t.sub_label, (m.get(t.sub_label) ?? 0) + t.amount);
    return m;
  };
  const now = subs(txs, o.day), before = subs(prevTxs, o.day);
  const growth = [...now.entries()]
    .map(([k, v]) => ({ k, v, prev: before.get(k) ?? 0 }))
    .filter((g) => g.v - g.prev >= 80 && g.prev > 0)
    .sort((a, b) => b.v - b.prev - (a.v - a.prev))[0];
  if (growth) {
    const pct = Math.round((growth.v / growth.prev - 1) * 100);
    out.push({ text: `${growth.k} subiu ${pct}% em relação a ${prevName}: ${BRL(growth.v)} até agora.`, ask: `Por que ${growth.k.toLowerCase()} subiu tanto esse mês?` });
  }

  const card = o.cards.filter((c) => c.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0];
  if (card) {
    const close = card.close_date ? `fecha em ${card.close_date.slice(8, 10)}/${card.close_date.slice(5, 7)} e ` : "";
    out.push({ text: `A fatura do ${card.institution ?? card.name} ${close}vence em ${card.due_date!.slice(8, 10)}/${card.due_date!.slice(5, 7)}. Está em ${BRL(Math.abs(card.balance))}.`, ask: `Como está a fatura do ${card.institution ?? "cartão"}?` });
  }

  if (o.isCurrent) {
    if (o.savingsGoal > 0) {
      out.push(
        o.spend.free > 0
          ? { text: `Sobram ${BRL(o.spend.free)} livres até o fim do mês se você mantiver a meta de guardar ${BRL(o.savingsGoal)}.`, ask: "Quanto posso gastar por dia até o fim do mês?" }
          : { text: `Do jeito que está, a meta de guardar ${BRL(o.savingsGoal)} não fecha este mês. Faltam ${BRL(-o.spend.free)}.`, ask: "Onde dá para cortar para eu bater a meta de poupança?" },
      );
    } else {
      out.push({ text: "Você ainda não disse quanto quer guardar por mês. Com isso eu calculo quanto pode gastar por dia.", ask: "Quero guardar um valor por mês. Me ajuda a definir quanto?" });
    }
  }
  return out.slice(0, 3);
}

export function headline(o: Overview, name: string) {
  const mes = monthName(o.ym);
  const Mes = mes[0].toUpperCase() + mes.slice(1);
  const diff = o.prevSpentSamePoint - o.spent;
  const prevName = monthName(addMonths(o.ym as Ym, -1));
  if (o.prevSpentSamePoint === 0) return { title: `${Mes} em andamento, ${name}.`, lede: `Você gastou ${BRL(o.spent)} até o dia ${o.day}.` };
  if (diff >= 0)
    return { title: o.isCurrent ? `${Mes} tá indo melhor que ${prevName}, ${name}.` : `${Mes} fechou abaixo de ${prevName}, ${name}.`, lede: `Você gastou ${BRL(diff)} a menos que em ${prevName} até o dia ${o.day}. Separei o que vale a pena olhar:` };
  return { title: o.isCurrent ? `${Mes} tá mais caro que ${prevName}, ${name}.` : `${Mes} fechou acima de ${prevName}, ${name}.`, lede: `Você gastou ${BRL(-diff)} a mais que em ${prevName} até o dia ${o.day}. Separei o que vale a pena olhar:` };
}
