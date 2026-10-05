import { TxList, type AccountOption, type TxView } from "@/components/TxList";
import { today } from "@/lib/dates";
import { categoryOptions } from "@/lib/actions";
import { accounts, txsBetween } from "@/lib/queries";
import { parseFilter } from "@/lib/txFilter";

export const metadata = { title: "Transações · liu liu" };

export default async function Transactions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filter = parseFilter(await searchParams, today());
  const [txs, accs, options] = await Promise.all([txsBetween(filter.from, filter.to), accounts(), categoryOptions()]);
  const byId = new Map(accs.map((a) => [a.id, a]));
  const view: TxView[] = txs.map((t) => {
    const a = byId.get(t.account_id);
    return {
      id: t.id, date: t.date, description: t.description, amount: t.amount, direction: t.direction, group_key: t.group_key, sub_label: t.sub_label,
      excluded: t.excluded, hidden: !!t.hidden, note: t.note ?? null, edited: !!t.edited,
      original_description: t.original_description ?? t.description, original_amount: t.original_amount ?? t.amount, original_date: t.original_date ?? t.date,
      source: t.source, installment: t.total_installments && t.total_installments > 1 ? `${t.installment_number}/${t.total_installments}` : null,
      account: { id: t.account_id, name: a?.institution ?? a?.name ?? "Dinheiro", color: a?.color ?? null, type: a?.type ?? "MANUAL" },
    };
  });
  const accountOptions: AccountOption[] = accs.map((a) => {
    const name = a.institution ?? a.name;
    const kind = a.type === "CREDIT" ? `cartão${a.number ? ` •••• ${a.number.slice(-4)}` : ""}` : a.type === "BANK" ? (a.subtype === "SAVINGS_ACCOUNT" ? "poupança" : "conta") : "";
    return { id: a.id, name, label: kind ? `${name} · ${kind}` : name, color: a.color };
  });
  return <TxList txs={view} today={today()} accounts={accountOptions} options={options} filter={filter} />;
}
