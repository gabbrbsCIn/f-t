"use client";
import { useEffect, useState } from "react";

type Health = { env: Record<string, boolean>; database: { ok: boolean; error?: string } };

const HELP: Record<string, string> = {
  DATABASE_URL: "Conecte um Postgres na aba Storage (Neon) e faça um Redeploy.",
  APP_PASSWORD: "Defina a senha de acesso em Settings → Environment Variables.",
  PLUGGY_CLIENT_ID: "Copie do dashboard.pluggy.ai.",
  PLUGGY_CLIENT_SECRET: "Copie do dashboard.pluggy.ai.",
  OLLAMA_API_KEY: "Crie em ollama.com/settings/keys.",
};

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setH).catch(() => setH(null));
  }, []);
  const missing = h ? Object.entries(h.env).filter(([, v]) => !v).map(([k]) => k) : [];
  return (
    <div className="p empty" style={{ marginTop: 24, alignItems: "flex-start", textAlign: "left" }}>
      <h2>Algo na configuração impediu a página de abrir</h2>
      {h === null && <p>Verificando a configuração…</p>}
      {h && !h.database.ok && (
        <p>
          <b>Banco de dados:</b> {h.database.error ?? "não respondeu."}
        </p>
      )}
      {missing.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--fg-2)" }}>
          {missing.map((k) => (
            <li key={k}><b style={{ color: "var(--fg)" }}>{k}</b> não está definida. {HELP[k] ?? ""}</li>
          ))}
        </ul>
      )}
      {h && h.database.ok && missing.length === 0 && <p>A configuração parece certa. Código do erro: {error.digest ?? "—"}.</p>}
      <p className="faint" style={{ fontSize: 12.5 }}>Depois de mudar variáveis na Vercel, é preciso fazer um Redeploy para elas valerem.</p>
      <button className="btn pri" onClick={reset}>Tentar de novo</button>
    </div>
  );
}
