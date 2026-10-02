"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SavingsGoalForm({ current }: { current: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(current === 0);
  const [err, setErr] = useState<string | null>(null);
  if (!editing)
    return (
      <button className="more" onClick={() => setEditing(true)}>
        mudar meta de poupança
      </button>
    );
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = Number(String(new FormData(e.currentTarget).get("v")).replace(/\./g, "").replace(",", "."));
        const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ savings_goal: v }) });
        if (!r.ok) return setErr("Digite um valor em reais, ex.: 3000");
        setEditing(false);
        router.refresh();
      }}
    >
      <label htmlFor="savings" className="faint" style={{ fontSize: 12.5 }}>Quero guardar por mês R$</label>
      <input id="savings" name="v" className="field" inputMode="decimal" defaultValue={current || ""} placeholder="3.000" required />
      <button className="btn pri">Salvar</button>
      {err && <span className="err">{err}</span>}
    </form>
  );
}
