"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GROUPS, group } from "@/lib/categories";
import { normalize } from "@/lib/categorize";
import { addDays, addMonths, monthEnd, monthLabel, monthStart, ymOf } from "@/lib/dates";
import { BRL } from "@/lib/format";
import { emptyFilter, filterQuery, isWholeMonth, matches, shiftPeriod, txHref, type TxFilter } from "@/lib/txFilter";
import { BankTile } from "./BankTile";
import type { CatOption } from "./CategoryPicker";
import { FilterMenu } from "./FilterMenu";
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

export type AccountOption = { id: string; name: string; label: string; color: string | null };

const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const KINDS: [TxFilter["kind"], string][] = [["all", "Todas"], ["out", "Saídas"], ["in", "Entradas"], ["moved", "Entre contas"]];
// Groups you can filter by: the spending groups plus income and moves between your own accounts.
const CAT_GROUPS = [...GROUPS.map((g) => ({ key: g.key as string, name: g.name, color: g.color })), { key: "entrada", name: "Entradas", color: "var(--pos)" }, { key: "transfer", name: "Entre suas contas", color: "var(--line-2)" }];
const groupMeta = (key: string) => CAT_GROUPS.find((g) => g.key === key) ?? { key, name: group(key).name, color: group(key).color };

const dm = (d: string) => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`;

function dayTitle(d: string, today: string) {
  const label = `${WD[new Date(`${d}T12:00:00Z`).getUTCDay()]}, ${dm(d)}`;
  return d === today ? `Hoje · ${label}` : label[0].toUpperCase() + label.slice(1);
}

function periodLabel(from: string, to: string, today: string) {
  if (isWholeMonth(from, to)) return monthLabel(ymOf(from));
  if (from === to) return `${dayTitle(from, today)}${from.slice(0, 4) !== today.slice(0, 4) ? ` ${from.slice(0, 4)}` : ""}`;
  const y = (d: string) => (from.slice(0, 4) !== to.slice(0, 4) || d.slice(0, 4) !== today.slice(0, 4) ? ` ${d.slice(0, 4)}` : "");
  return `${dm(from)}${from.slice(0, 4) !== to.slice(0, 4) ? y(from) : ""} – ${dm(to)}${y(to)}`;
}

const money = (v: string) => {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return v.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};

export function TxList({ txs, today, accounts, options: initialOptions, filter: initial }: { txs: TxView[]; today: string; accounts: AccountOption[]; options: CatOption[]; filter: TxFilter }) {
  const router = useRouter();
  const [f, setF] = useState<TxFilter>(initial);
  const [editing, setEditing] = useState<TxView | "new" | null>(null);
  const [options, setOptions] = useState(initialOptions);
  const set = (patch: Partial<TxFilter>) => setF((p) => ({ ...p, ...patch }));

  // A new URL from outside (a link from another screen, the back button) replaces the filters.
  const initialKey = filterQuery(initial);
  useEffect(() => setF(initial), [initialKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the address bar in sync, so the filtered list can be bookmarked or reopened.
  useEffect(() => {
    const url = `/transacoes?${filterQuery(f)}`;
    if (url !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", url);
  }, [f]);

  // The period decides which transactions the server loads, so changing it is a navigation.
  const goPeriod = (from: string, to: string) => router.push(txHref({ ...f, from, to }));

  const searchText = useMemo(() => new Map(txs.map((t) => [t.id, normalize(`${t.description} ${t.original_description} ${t.sub_label} ${groupMeta(t.group_key).name} ${t.note ?? ""} ${t.amount.toFixed(2).replace(".", ",")}`)])), [txs]);
  const shown = useMemo(() => {
    const nq = normalize(f.q);
    return txs.filter((t) => matches(t, f, () => !nq || (searchText.get(t.id) ?? "").includes(nq)));
  }, [txs, f, searchText]);

  const hiddenCount = txs.filter((t) => t.hidden).length;
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

  const next = shiftPeriod(f.from, f.to, 1);
  const pills: { key: string; label: React.ReactNode; clear: () => void }[] = [
    ...f.cats.map((c) => {
      const [g, sub] = c.includes(":") ? [c.slice(0, c.indexOf(":")), c.slice(c.indexOf(":") + 1)] : [c, null];
      return { key: `c${c}`, label: <><i className="cdot" style={{ background: groupMeta(g).color }} />{sub ? `${groupMeta(g).name} › ${sub}` : groupMeta(g).name}</>, clear: () => set({ cats: f.cats.filter((x) => x !== c) }) };
    }),
    ...f.accounts.map((a) => {
      const acc = accounts.find((x) => x.id === a);
      return { key: `a${a}`, label: acc?.label ?? "Conta", clear: () => set({ accounts: f.accounts.filter((x) => x !== a) }) };
    }),
    ...(f.min != null || f.max != null ? [{ key: "v", label: f.min != null && f.max != null ? `${BRL(f.min)} a ${BRL(f.max)}` : f.min != null ? `a partir de ${BRL(f.min)}` : `até ${BRL(f.max!)}`, clear: () => set({ min: null, max: null }) }] : []),
    ...(f.installments ? [{ key: "p", label: "Só parceladas", clear: () => set({ installments: false }) }] : []),
    ...(f.edited ? [{ key: "e", label: "Só editadas", clear: () => set({ edited: false }) }] : []),
    ...(f.noted ? [{ key: "o", label: "Com observação", clear: () => set({ noted: false }) }] : []),
  ];
  const anyFilter = pills.length > 0 || f.kind !== "all" || !!f.q.trim();
  const clearAll = () => setF({ ...emptyFilter(today), from: f.from, to: f.to, hidden: f.hidden });

  return (
    <>
      <div className="screen-h">
        <div className="period">
          <div className="month">
            <button type="button" className="mbtn" aria-label="Período anterior" onClick={() => { const p = shiftPeriod(f.from, f.to, -1); goPeriod(p.from, p.to); }}>‹</button>
            <span>{periodLabel(f.from, f.to, today)}</span>
            <button type="button" className="mbtn" aria-label="Próximo período" disabled={next.from > today} style={next.from > today ? { opacity: 0.3 } : undefined} onClick={() => goPeriod(next.from, next.to)}>›</button>
          </div>
          <FilterMenu label="Período">{(close) => <PeriodPanel f={f} today={today} onPick={(a, b) => { close(); goPeriod(a, b); }} />}</FilterMenu>
        </div>
        <span className="faint" style={{ fontSize: 12.5 }}>clique numa transação para ver e editar</span>
      </div>

      <div className="tx-sum">
        <div className="p"><span className="lbl">Transações</span><b className="n">{sums.count}</b></div>
        <div className="p"><span className="lbl">Saídas</span><b className="n neg">{BRL(sums.out)}</b></div>
        <div className="p"><span className="lbl">Entradas</span><b className="n pos">{BRL(sums.inc)}</b></div>
        <div className="p"><span className="lbl">Saldo</span><b className={`n ${sums.net >= 0 ? "pos" : "neg"}`}>{sums.net >= 0 ? "" : "− "}{BRL(Math.abs(sums.net))}</b></div>
      </div>

      <div className="toolbar">
        <label className="search"><Icon name="search" /><input id="tx-q" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar loja, categoria, observação ou valor" /></label>
        <button className="btn pri" onClick={() => setEditing("new")} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Icon name="plus" size={14} />Nova transação</button>
      </div>
      <div className="toolbar" style={{ marginTop: -4 }}>
        <div className="chips">
          {KINDS.map(([k, l]) => <button key={k} aria-pressed={f.kind === k} onClick={() => set({ kind: k })}>{l}</button>)}
        </div>
        <span className="tb-sep" aria-hidden="true" />
        <FilterMenu label="Categoria" count={f.cats.length} wide>{() => <CategoryPanel txs={txs} f={f} options={options} onChange={(cats) => set({ cats })} />}</FilterMenu>
        <FilterMenu label="Conta" count={f.accounts.length}>{() => <AccountPanel txs={txs} accounts={accounts} selected={f.accounts} onChange={(a) => set({ accounts: a })} />}</FilterMenu>
        <FilterMenu label="Mais filtros" count={[f.min != null || f.max != null, f.installments, f.edited, f.noted].filter(Boolean).length}>{() => <MorePanel f={f} set={set} />}</FilterMenu>
        <label className="check" style={{ marginLeft: "auto", marginTop: 0 }}>
          <input type="checkbox" checked={f.hidden} onChange={(e) => set({ hidden: e.target.checked })} /> Mostrar ocultas{hiddenCount ? ` (${hiddenCount})` : ""}
        </label>
      </div>
      {(pills.length > 0 || anyFilter) && (
        <div className="pills">
          {pills.map((p) => (
            <button key={p.key} className="pill" onClick={p.clear} title="Tirar este filtro">{p.label}<Icon name="close" size={12} /></button>
          ))}
          <button className="pill-clear" onClick={clearAll}>Limpar filtros</button>
        </div>
      )}

      {days.length === 0 && (
        <div className="p faint" style={{ textAlign: "center" }}>
          {txs.length === 0 ? "Nenhuma transação neste período." : "Nada com esses filtros."}{" "}
          {anyFilter && <button className="linkish" onClick={clearAll}>Limpar filtros</button>}
        </div>
      )}
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
                    <i className="cdot" style={{ background: groupMeta(t.group_key).color }} />
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

function PeriodPanel({ f, today, onPick }: { f: TxFilter; today: string; onPick: (from: string, to: string) => void }) {
  const ym = ymOf(today);
  const [from, setFrom] = useState(f.from);
  const [to, setTo] = useState(f.to);
  const presets: [string, string, string][] = [
    ["Este mês", monthStart(ym), monthEnd(ym)],
    ["Mês passado", monthStart(addMonths(ym, -1)), monthEnd(addMonths(ym, -1))],
    ["Hoje", today, today],
    ["Últimos 7 dias", addDays(today, -6), today],
    ["Últimos 30 dias", addDays(today, -29), today],
    ["Últimos 3 meses", monthStart(addMonths(ym, -2)), monthEnd(ym)],
    ["Este ano", `${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`],
  ];
  return (
    <div className="fm-body">
      <div className="fm-presets">
        {presets.map(([l, a, b]) => (
          <button key={l} type="button" className={`cp-opt ${a === f.from && b === f.to ? "on" : ""}`} onClick={() => onPick(a, b)}>{l}</button>
        ))}
      </div>
      <form className="fm-range" onSubmit={(e) => { e.preventDefault(); if (from && to) onPick(from <= to ? from : to, from <= to ? to : from); }}>
        <span className="cp-h" style={{ padding: "0 0 6px" }}>Personalizado</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="date" className="field" value={from} max={today} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
          <span className="faint">a</span>
          <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
        </div>
        <button className="btn pri" style={{ marginTop: 8, width: "100%" }}>Aplicar</button>
      </form>
    </div>
  );
}

function CategoryPanel({ txs, f, options, onChange }: { txs: TxView[]; f: TxFilter; options: CatOption[]; onChange: (cats: string[]) => void }) {
  const [q, setQ] = useState("");
  const nq = normalize(q);
  // Subcategories with transactions in this period first (with counts), then your own categories.
  const tree = useMemo(() => {
    const counts = new Map<string, Map<string, number>>();
    for (const t of txs) {
      if (t.hidden && !f.hidden) continue;
      const m = counts.get(t.group_key) ?? new Map<string, number>();
      m.set(t.sub_label, (m.get(t.sub_label) ?? 0) + 1);
      counts.set(t.group_key, m);
    }
    for (const o of options) if (o.custom) counts.set(o.group_key, (counts.get(o.group_key) ?? new Map()).set(o.label, counts.get(o.group_key)?.get(o.label) ?? 0));
    return CAT_GROUPS.map((g) => {
      const subs = [...(counts.get(g.key) ?? new Map()).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return { ...g, total: subs.reduce((s, [, n]) => s + n, 0), subs };
    }).filter((g) => g.subs.length || f.cats.some((c) => c === g.key || c.startsWith(`${g.key}:`)));
  }, [txs, options, f.hidden, f.cats]);

  const has = (t: string) => f.cats.includes(t);
  const toggle = (token: string) => {
    if (has(token)) return onChange(f.cats.filter((c) => c !== token));
    // Picking a whole group replaces any of its single subcategories.
    onChange([...f.cats.filter((c) => token.includes(":") || !c.startsWith(`${token}:`)), token]);
  };

  return (
    <div className="fm-body">
      <label className="search" style={{ minWidth: 0, margin: "0 0 6px" }}>
        <Icon name="search" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar categoria…" />
      </label>
      <div className="cp-list fm-list">
        {tree.map((g) => {
          const groupHit = !nq || normalize(g.name).includes(nq);
          const subs = g.subs.filter(([s]) => groupHit || normalize(s).includes(nq));
          if (!groupHit && !subs.length) return null;
          const whole = has(g.key);
          return (
            <div key={g.key}>
              <label className="fm-row fm-g">
                <input type="checkbox" checked={whole} onChange={() => toggle(g.key)} />
                <i className="cdot" style={{ background: g.color }} />
                <span className="grow">{g.name}</span>
                <span className="faint n">{g.total || ""}</span>
              </label>
              {subs.map(([s, n]) => (
                <label key={s} className="fm-row fm-s">
                  <input type="checkbox" checked={whole || has(`${g.key}:${s}`)} disabled={whole} onChange={() => toggle(`${g.key}:${s}`)} />
                  <span className="grow">{s}</span>
                  <span className="faint n">{n || ""}</span>
                </label>
              ))}
            </div>
          );
        })}
        {!tree.length && <p className="faint" style={{ padding: "6px 4px", margin: 0 }}>Nenhuma categoria neste período.</p>}
      </div>
      {f.cats.length > 0 && <button type="button" className="pill-clear" style={{ marginTop: 8 }} onClick={() => onChange([])}>Limpar categorias</button>}
    </div>
  );
}

function AccountPanel({ txs, accounts, selected, onChange }: { txs: TxView[]; accounts: AccountOption[]; selected: string[]; onChange: (a: string[]) => void }) {
  const counts = new Map<string, number>();
  for (const t of txs) counts.set(t.account.id, (counts.get(t.account.id) ?? 0) + 1);
  return (
    <div className="fm-body">
      {accounts.map((a) => (
        <label key={a.id} className="fm-row">
          <input type="checkbox" checked={selected.includes(a.id)} onChange={() => onChange(selected.includes(a.id) ? selected.filter((x) => x !== a.id) : [...selected, a.id])} />
          <BankTile name={a.name} color={a.color} small />
          <span className="grow">{a.label}</span>
          <span className="faint n">{counts.get(a.id) ?? ""}</span>
        </label>
      ))}
      {!accounts.length && <p className="faint" style={{ margin: 0 }}>Nenhuma conta conectada.</p>}
    </div>
  );
}

function MorePanel({ f, set }: { f: TxFilter; set: (p: Partial<TxFilter>) => void }) {
  const fmt = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
  const [min, setMin] = useState(fmt(f.min));
  const [max, setMax] = useState(fmt(f.max));
  return (
    <div className="fm-body" style={{ minWidth: 250 }}>
      <form onSubmit={(e) => { e.preventDefault(); set({ min: money(min), max: money(max) }); }}>
        <span className="cp-h" style={{ padding: "0 0 6px" }}>Valor (R$)</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input className="field" inputMode="decimal" placeholder="de" value={min} onChange={(e) => setMin(e.target.value)} onBlur={() => set({ min: money(min) })} aria-label="Valor mínimo" />
          <span className="faint">a</span>
          <input className="field" inputMode="decimal" placeholder="até" value={max} onChange={(e) => setMax(e.target.value)} onBlur={() => set({ max: money(max) })} aria-label="Valor máximo" />
        </div>
        <button className="btn" style={{ marginTop: 8, width: "100%" }}>Aplicar valor</button>
      </form>
      <div style={{ marginTop: 10 }}>
        <label className="fm-row"><input type="checkbox" checked={f.installments} onChange={(e) => set({ installments: e.target.checked })} />Só compras parceladas</label>
        <label className="fm-row"><input type="checkbox" checked={f.edited} onChange={(e) => set({ edited: e.target.checked })} />Só as que você editou</label>
        <label className="fm-row"><input type="checkbox" checked={f.noted} onChange={(e) => set({ noted: e.target.checked })} />Com observação</label>
      </div>
    </div>
  );
}
