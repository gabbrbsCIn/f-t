"use client";
import { useState } from "react";

export function LoginForm() {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const password = new FormData(e.currentTarget).get("password");
        const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
        if (r.ok) window.location.href = "/";
        else {
          setErr((await r.json().catch(() => ({}))).error ?? "Não deu para entrar.");
          setBusy(false);
        }
      }}
    >
      <label htmlFor="password" className="lbl">Senha</label>
      <input id="password" name="password" type="password" className="field" autoComplete="current-password" autoFocus required />
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn pri" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
