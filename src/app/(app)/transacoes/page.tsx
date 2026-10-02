import { MonthSwitch } from "@/components/MonthSwitch";
import { TxList, type TxView } from "@/components/TxList";
import { today, validYm, ymOf } from "@/lib/dates";
import { accounts, txsOfMonth } from "@/lib/queries";

export const metadata = { title: "Transações · liu liu" };

export default async function Transactions({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ym = validYm((await searchParams).m) ?? ymOf(today());
  const [txs, accs] = await Promise.all([txsOfMonth(ym), accounts()]);
  const byId = new Map(accs.map((a) => [a.id, a]));
  const view: TxView[] = txs.map((t) => {
    const a = byId.get(t.account_id);
    return {
      id: t.id, date: t.date, description: t.description, amount: t.amount, direction: t.direction, group_key: t.group_key, sub_label: t.sub_label,
      excluded: t.excluded, source: t.source, installment: t.total_installments && t.total_installments > 1 ? `${t.installment_number}/${t.total_installments}` : null,
      account: { id: t.account_id, name: a?.institution ?? a?.name ?? "Dinheiro", color: a?.color ?? null, type: a?.type ?? "MANUAL" },
    };
  });
  const cardFilters = accs.filter((a) => a.type === "CREDIT").map((a) => ({ id: a.id, label: `Cartão ${a.institution ?? a.name}` }));
  return (
    <>
      <div className="screen-h">
        <MonthSwitch ym={ym} path="/transacoes" />
        <span className="faint" style={{ fontSize: 12.5 }}>{txs.length} transações · clique na categoria para corrigir</span>
      </div>
      <TxList txs={view} today={today()} accounts={cardFilters} />
    </>
  );
}
