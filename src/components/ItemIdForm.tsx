"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Register an item that already exists in the Pluggy dashboard by pasting its ID. */
export function ItemIdForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="inline-form"
      style={{ justifyContent: "center" }}
      onSubmit={async (e) => {
        e.preventDefault();
        const itemId = String(new FormData(e.currentTarget).get("itemId") ?? "").trim();
        if (!itemId) return;
        setBusy(true);
        setMsg(null);
        const r = await fetch("/api/pluggy/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId }) })
          .then(async (x) => ({ ok: x.ok, body: await x.json().catch(() => ({})) }))
          .catch(() => ({ ok: false, body: { error: "Sem conexão." } }));
        setBusy(false);
        if (r.ok) {
          setMsg({ ok: true, text: `Importei ${r.body.transactions} transações de ${r.body.accounts} contas.` });
          router.refresh();
        } else setMsg({ ok: false, text: r.body.error ?? "Não consegui importar esse item." });
      }}
    >
      <label htmlFor="itemId" className="faint" style={{ fontSize: 12.5, width: "100%", textAlign: "center" }}>
        Já conectou pelo painel da Pluggy? Cole o ID do item (aparece acima do nome “MeuPluggy”):
      </label>
      <input id="itemId" name="itemId" className="field" style={{ width: 330, fontFamily: "var(--f-num)", fontSize: 12.5 }} placeholder="0880bcd8-a09e-4cc4-…" required pattern="[\w-]{8,64}" />
      <button className="btn" disabled={busy}>{busy ? "Importando… (pode levar 1 min)" : "Importar"}</button>
      {msg && <span className={msg.ok ? "pos" : "err"} style={{ width: "100%", textAlign: "center" }}>{msg.text}</span>}
    </form>
  );
}
