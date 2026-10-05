"use client";
import { useState } from "react";
import { BRL } from "@/lib/format";
import { CategoryPicker, type CatOption, type CatValue } from "./CategoryPicker";
import type { TxView } from "./TxList";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Edit a transaction (or create one when `tx` is null). */
export function TxModal({ tx, options, onClose, onSaved, onOptionsChange }: {
  tx: TxView | null;
  options: CatOption[];
  onClose: () => void;
  onSaved: () => void;
  onOptionsChange: (o: CatOption[]) => void;
}) {
  const creating = tx === null;
  const [description, setDescription] = useState(tx?.description ?? "");
  const [amount, setAmount] = useState(tx ? tx.amount.toFixed(2).replace(".", ",") : "");
  const [date, setDate] = useState(tx?.date ?? today());
  const [direction, setDirection] = useState<"in" | "out">(tx?.direction ?? "out");
  const [cat, setCat] = useState<CatValue>(tx ? { group_key: tx.group_key, label: tx.sub_label } : { group_key: "outros", label: "Sem categoria" });
  const [rule, setRule] = useState(false);
  const [hidden, setHidden] = useState(tx?.hidden ?? false);
  const [note, setNote] = useState(tx?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const value = Number(amount.replace(/\./g, "").replace(",", "."));
  const catChanged = !!tx && (cat.group_key !== tx.group_key || cat.label !== tx.sub_label);

  async function call(url: string, method: string, body?: unknown) {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? "Não deu para salvar.");
    return j;
  }

  async function save() {
    setErr(null);
    if (!description.trim()) return setErr("Dê um nome para a transação.");
    if (!Number.isFinite(value) || value <= 0) return setErr("Digite um valor válido, ex.: 42,90");
    setBusy(true);
    try {
      if (creating) {
        await call("/api/transactions", "POST", { description, amount: value, date, direction, group_key: direction === "out" ? cat.group_key : "entrada", sub_label: direction === "out" ? cat.label : undefined, note });
      } else {
        await call(`/api/transactions/${encodeURIComponent(tx.id)}`, "PATCH", {
          description: description.trim() === tx.original_description ? null : description,
          amount: Math.abs(value - tx.original_amount) < 0.005 ? null : value,
          date: date === tx.original_date ? null : date,
          hidden,
          note,
          ...(catChanged ? { group_key: cat.group_key, sub_label: cat.label, rule } : {}),
        });
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function restore() {
    if (!tx) return;
    setBusy(true);
    try {
      await call(`/api/transactions/${encodeURIComponent(tx.id)}`, "PATCH", { description: null, amount: null, date: null });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!tx) return;
    setBusy(true);
    try {
      await call(`/api/transactions/${encodeURIComponent(tx.id)}`, "DELETE");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function createCat(v: CatValue) {
    const j = await call("/api/categories", "POST", v);
    onOptionsChange([{ group_key: j.group_key, label: j.label, custom: true }, ...options]);
  }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal txm" role="dialog" aria-modal="true" aria-label={creating ? "Nova transação" : "Detalhes da transação"} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2>{creating ? "Nova transação" : "Detalhes da transação"}</h2>

        <label className="lbl" htmlFor="tx-desc">Descrição</label>
        <input id="tx-desc" className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} autoFocus={creating} />
        {tx && description.trim() !== tx.original_description && <div className="t2">No banco: {tx.original_description}</div>}

        <div className="txm-row">
          <div style={{ flex: 1 }}>
            <label className="lbl" htmlFor="tx-amount">Valor</label>
            <div className="amount-field">
              {creating ? (
                <button type="button" className={`sign ${direction === "in" ? "pos" : "neg"}`} onClick={() => setDirection((d) => (d === "in" ? "out" : "in"))} title="Trocar entre saída e entrada">
                  {direction === "in" ? "+ R$" : "− R$"}
                </button>
              ) : (
                <span className={`sign ${direction === "in" ? "pos" : "neg"}`}>{direction === "in" ? "+ R$" : "− R$"}</span>
              )}
              <input id="tx-amount" className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            {tx && Math.abs(value - tx.original_amount) >= 0.005 && <div className="t2">No banco: {BRL(tx.original_amount)}</div>}
          </div>
          <div style={{ width: 170 }}>
            <label className="lbl" htmlFor="tx-date">Data</label>
            <input id="tx-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {tx && (
          <div className="txm-kv">
            <span className="faint">Conta</span>
            <span>{tx.account.name}{tx.account.type === "CREDIT" ? " · crédito" : ""}{tx.installment ? ` · parcela ${tx.installment}` : ""}</span>
          </div>
        )}

        {direction === "out" && (
          <>
            <label className="lbl">Categoria</label>
            <CategoryPicker value={cat} options={options} onChange={setCat} onCreate={createCat} />
            {catChanged && (
              <label className="check">
                <input type="checkbox" checked={rule} onChange={(e) => setRule(e.target.checked)} /> Aplicar também às transações parecidas (passadas e futuras)
              </label>
            )}
          </>
        )}

        <label className="lbl" htmlFor="tx-note">Observação</label>
        <textarea id="tx-note" className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Opcional" />

        {tx && (
          <label className="check">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Ocultar (some da lista e não entra nas contas)
          </label>
        )}

        {err && <p className="err" role="alert">{err}</p>}

        {confirmDel ? (
          <div className="confirm-bar" style={{ margin: "12px -22px -22px", borderRadius: "0 0 14px 14px" }}>
            <span>Apagar esta transação?</span>
            <button type="button" className="btn" onClick={() => setConfirmDel(false)}>Cancelar</button>
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>Apagar</button>
          </div>
        ) : (
          <div className="mf" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {tx && tx.source !== "pluggy" && <button type="button" className="btn" onClick={() => setConfirmDel(true)}>Apagar</button>}
              {tx?.edited && <button type="button" className="btn" onClick={restore} disabled={busy} title="Volta descrição, valor e data ao que veio do banco">Restaurar original</button>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" onClick={onClose}>Cancelar</button>
              <button className="btn pri" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
