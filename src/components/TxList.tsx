"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GROUPS, group } from "@/lib/categories";
import { normalize } from "@/lib/categorize";
import { BRL } from "@/lib/format";
import { BankTile } from "./BankTile";
import { Icon } from "./Icon";

export type TxView = {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  group_key: string;
  sub_label: string;
  excluded: boolean;
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

export function TxList({ txs, today, accounts }: { txs: TxView[]; today: string; accounts: { id: string; label: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const filters = [["all", "Todas"], ["out", "Saídas"], ["in", "Entradas"], ...accounts.map((a) => [a.id, a.label]), ["hidden", "Fora dos gastos"]];

  const shown = useMemo(() => {
    const nq = normalize(q);
    return txs.filter((t) => {
      if (filter === "out" && (t.direction !== "out" || t.excluded)) return false;
      if (filter === "in" && (t.direction !== "in" || t.excluded)) return false;
      if (filter === "hidden" && !t.excluded) return false;
      if (!["all", "out", "in", "hidden"].includes(filter) && t.account.id !== filter) return false;
      if (filter !== "hidden" && filter !== "all" && t.excluded) return false;
      if (!nq) return true;
      return normalize(`${t.description} ${t.sub_label} ${group(t.group_key).name} ${t.amount.toFixed(2).replace(".", ",")}`).includes(nq);
    });
  }, [txs, q, filter]);

  const days = useMemo(() => {
    const m = new Map<string, TxView[]>();
    for (const t of shown) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [shown]);

  async function save(t: TxView, value: string, rule: boolean) {
    const [g, sub] = value.split("|");
    await fetch(`/api/transactions/${encodeURIComponent(t.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ group_key: g, sub_label: sub, rule }) });
    setEditing(null);
    router.refresh();
  }

  const subsByGroup = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const t of txs) if (t.direction === "out") m.set(t.group_key, (m.get(t.group_key) ?? new Set()).add(t.sub_label));
    return m;
  }, [txs]);

  return (
    <>
      <div className="toolbar">
        <label className="search"><Icon name="search" /><input id="tx-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar loja, categoria ou valor" /></label>
        <div className="chips">
          {filters.map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
      </div>
      {days.length === 0 && <div className="p faint" style={{ textAlign: "center" }}>Nada com esse filtro. Tente outra palavra ou volte para “Todas”.</div>}
      {days.map(([day, list]) => {
        const out = list.filter((t) => t.direction === "out" && !t.excluded).reduce((s, t) => s + t.amount, 0);
        return (
          <section key={day}>
            <div className="day-h"><span>{dayTitle(day, today)}</span><span className="n">{out ? `saiu ${BRL(out)}` : ""}</span></div>
            <div className="p plist">
              {list.map((t) => (
                <div className="tx" key={t.id} style={t.excluded ? { opacity: 0.55 } : undefined}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t1">
                      {t.description}
                      {t.source === "chat" && <span className="via">anotado na conversa</span>}
                      {t.installment && <span className="via" style={{ background: "var(--raise-2)", color: "var(--fg-2)" }}>{t.installment}</span>}
                    </div>
                    <div className="t2" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <BankTile name={t.account.name} color={t.account.color} small />
                      {t.account.name}{t.account.type === "CREDIT" ? " · crédito" : ""}
                    </div>
                  </div>
                  <div className="cat">
                    {editing === t.id && t.direction === "out" ? (
                      <CategoryPicker t={t} subsByGroup={subsByGroup} onSave={save} onCancel={() => setEditing(null)} />
                    ) : (
                      <button className="cat" style={{ cursor: t.direction === "out" ? "pointer" : "default" }} onClick={() => t.direction === "out" && setEditing(t.id)} title={t.direction === "out" ? "Mudar categoria" : undefined}>
                        <i className="cdot" style={{ background: t.group_key === "entrada" ? "var(--pos)" : t.excluded ? "var(--line-2)" : group(t.group_key).color }} />
                        <span className="t1" style={{ fontWeight: 400 }}>{t.sub_label}</span>
                      </button>
                    )}
                  </div>
                  <div className={`amt ${t.direction === "in" ? "pos" : ""}`}>{t.direction === "in" ? "+ " : "− "}{BRL(t.amount)}</div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function CategoryPicker({ t, subsByGroup, onSave, onCancel }: { t: TxView; subsByGroup: Map<string, Set<string>>; onSave: (t: TxView, v: string, rule: boolean) => void; onCancel: () => void }) {
  const [rule, setRule] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <select className="recat" autoFocus defaultValue={`${t.group_key}|${t.sub_label}`} onChange={(e) => onSave(t, e.target.value, rule)} onKeyDown={(e) => e.key === "Escape" && onCancel()} aria-label="Nova categoria">
        {GROUPS.map((g) => (
          <optgroup key={g.key} label={g.name}>
            {[...(subsByGroup.get(g.key) ?? new Set([g.name]))].sort().map((s) => <option key={s} value={`${g.key}|${s}`}>{s}</option>)}
          </optgroup>
        ))}
        <optgroup label="Fora dos gastos"><option value="transfer|Entre suas contas">Entre suas contas</option></optgroup>
      </select>
      <label className="faint" style={{ fontSize: 11.5, display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={rule} onChange={(e) => setRule(e.target.checked)} /> aplicar nas parecidas
      </label>
    </div>
  );
}
