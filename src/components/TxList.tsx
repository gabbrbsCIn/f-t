"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { group } from "@/lib/categories";
import { normalize } from "@/lib/categorize";
import { BRL } from "@/lib/format";
import { BankTile } from "./BankTile";
import type { CatOption } from "./CategoryPicker";
import { Icon } from "./Icon";
import { TxModal } from "./TxModal";

export type TxView = {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  group_key: string;
  sub_label: string;
  excluded: boolean;
  hidden: boolean;
  note: string | null;
  edited: boolean;
  original_description: string;
  original_amount: number;
  original_date: string;
  source: string;
  installment: string | null;
  account: { id: string; name: string; color: string | null; type: string };
};

const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function dayTitle(d: string, today: string) {
  const w = WD[new Date(`${d}T12:00:00Z`).getUTCDay()];
  const label = `${w}, ${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`;
  return d === today ? `Hoje · ${label}` : label[0].toUpperCase() + label.slice(1);
}

export function TxList({ txs, today, accounts, options: initialOptions }: { txs: TxView[]; today: string; accounts: { id: string; label: string }[]; options: CatOption[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<TxView | "new" | null>(null);
  const [options, setOptions] = useState(initialOptions);
  const filters = [["all", "Todas"], ["out", "Saídas"], ["in", "Entradas"], ...accounts.map((a) => [a.id, a.label]), ["moved", "Entre contas"]];
  const hiddenCount = txs.filter((t) => t.hidden).length;

  const shown = useMemo(() => {
    const nq = normalize(q);
    return txs.filter((t) => {
      if (t.hidden && !showHidden) return false;
      const moved = t.excluded && !t.hidden;
      if (filter === "out" && (t.direction !== "out" || moved)) return false;
      if (filter === "in" && (t.direction !== "in" || moved)) return false;
      if (filter === "moved" && !moved) return false;
      if (!["all", "out", "in", "moved"].includes(filter) && t.account.id !== filter) return false;
      if (!nq) return true;
      return normalize(`${t.description} ${t.original_description} ${t.sub_label} ${group(t.group_key).name} ${t.note ?? ""} ${t.amount.toFixed(2).replace(".", ",")}`).includes(nq);
    });
  }, [txs, q, filter, showHidden]);

  const sums = useMemo(() => {
    const counted = shown.filter((t) => !t.excluded);
    const out = counted.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
    const inc = counted.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
    return { count: shown.length, out, inc, net: inc - out };
  }, [shown]);

  const days = useMemo(() => {
    const m = new Map<string, TxView[]>();
    for (const t of shown) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [shown]);

  return (
    <>
      <div className="tx-sum">
        <div className="p"><span className="lbl">Transações</span><b className="n">{sums.count}</b></div>
        <div className="p"><span className="lbl">Saídas</span><b className="n neg">{BRL(sums.out)}</b></div>
        <div className="p"><span className="lbl">Entradas</span><b className="n pos">{BRL(sums.inc)}</b></div>
        <div className="p"><span className="lbl">Saldo</span><b className={`n ${sums.net >= 0 ? "pos" : "neg"}`}>{sums.net >= 0 ? "" : "− "}{BRL(Math.abs(sums.net))}</b></div>
      </div>

      <div className="toolbar">
        <label className="search"><Icon name="search" /><input id="tx-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar loja, categoria, observação ou valor" /></label>
        <button className="btn pri" onClick={() => setEditing("new")} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Icon name="plus" size={14} />Nova transação</button>
      </div>
      <div className="toolbar" style={{ marginTop: -4 }}>
        <div className="chips">
          {filters.map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        <label className="check" style={{ marginLeft: "auto", marginTop: 0 }}>
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Mostrar ocultas{hiddenCount ? ` (${hiddenCount})` : ""}
        </label>
      </div>

      {days.length === 0 && <div className="p faint" style={{ textAlign: "center" }}>Nada com esse filtro. Tente outra palavra ou volte para “Todas”.</div>}
      {days.map(([day, list]) => {
        const out = list.filter((t) => t.direction === "out" && !t.excluded).reduce((s, t) => s + t.amount, 0);
        return (
          <section key={day}>
            <div className="day-h"><span>{dayTitle(day, today)}</span><span className="n">{out ? `saiu ${BRL(out)}` : ""}</span></div>
            <div className="p plist">
              {list.map((t) => (
                <button className="tx tx-btn" key={t.id} onClick={() => setEditing(t)} style={t.excluded ? { opacity: t.hidden ? 0.4 : 0.55 } : undefined} title="Ver e editar">
                  <div style={{ minWidth: 0 }}>
                    <div className="t1">
                      {t.description}
                      {t.source === "chat" && <span className="via">anotado na conversa</span>}
                      {t.source === "manual" && <span className="via">criada por você</span>}
                      {t.hidden && <span className="via" style={{ background: "var(--raise-2)", color: "var(--fg-2)" }}>oculta</span>}
                      {t.edited && <span className="via" style={{ background: "var(--raise-2)", color: "var(--fg-2)" }}>editada</span>}
                      {t.installment && <span className="via" style={{ background: "var(--raise-2)", color: "var(--fg-2)" }}>{t.installment}</span>}
                    </div>
                    <div className="t2" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <BankTile name={t.account.name} color={t.account.color} small />
                      {t.account.name}{t.account.type === "CREDIT" ? " · crédito" : ""}{t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div className="cat">
                    <i className="cdot" style={{ background: t.group_key === "entrada" ? "var(--pos)" : t.group_key === "transfer" ? "var(--line-2)" : group(t.group_key).color }} />
                    <span className="t1" style={{ fontWeight: 400 }}>{t.sub_label}</span>
                  </div>
                  <div className={`amt ${t.direction === "in" ? "pos" : ""}`}>{t.direction === "in" ? "+ " : "− "}{BRL(t.amount)}</div>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {editing && (
        <TxModal
          key={editing === "new" ? "new" : editing.id}
          tx={editing === "new" ? null : editing}
          options={options}
          onOptionsChange={setOptions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
