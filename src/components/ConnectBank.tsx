"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// The Pluggy widget touches `window`, so it only loads in the browser.
const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((m) => m.PluggyConnect), { ssr: false });

type State = { step: "idle" } | { step: "loading" } | { step: "widget"; token: string } | { step: "importing" } | { step: "done"; text: string } | { step: "error"; text: string };

export function ConnectBank() {
  const router = useRouter();
  const [s, setS] = useState<State>({ step: "idle" });

  useEffect(() => {
    const open = async () => {
      setS({ step: "loading" });
      const r = await fetch("/api/pluggy/connect-token", { method: "POST" }).then(async (x) => ({ ok: x.ok, body: await x.json().catch(() => ({})) }));
      setS(r.ok ? { step: "widget", token: r.body.accessToken } : { step: "error", text: r.body.error ?? "Não deu para abrir a conexão." });
    };
    window.addEventListener("liu:connect", open);
    return () => window.removeEventListener("liu:connect", open);
  }, []);

  if (s.step === "idle") return null;
  if (s.step === "widget")
    return (
      <PluggyConnect
        connectToken={s.token}
        onClose={() => setS({ step: "idle" })}
        onError={(e) => setS({ step: "error", text: e.message })}
        onSuccess={async ({ item }) => {
          setS({ step: "importing" });
          const r = await fetch("/api/pluggy/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: item.id }) }).then((x) => x.json()).catch(() => ({ error: "sem conexão" }));
          setS(r.ok ? { step: "done", text: `${item.connector.name} conectado. Importei ${r.transactions} transações de ${r.accounts} contas.` } : { step: "error", text: r.error ?? "A importação falhou." });
          router.refresh();
        }}
      />
    );

  const close = () => setS({ step: "idle" });
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Conectar banco">
        {s.step === "loading" && <p className="muted">Abrindo a conexão segura…</p>}
        {s.step === "importing" && <><h2>Importando…</h2><p className="muted">Buscando os últimos 12 meses. Pode levar um minuto.</p></>}
        {s.step === "done" && <><h2>Pronto</h2><p className="muted">{s.text}</p></>}
        {s.step === "error" && <><h2>Algo deu errado</h2><p className="err">{s.text}</p></>}
        <div className="secure">Open Finance regulado pelo Banco Central · conexão pela Pluggy</div>
        {s.step !== "loading" && s.step !== "importing" && <div className="mf"><button className="btn pri" onClick={close}>Fechar</button></div>}
      </div>
    </div>
  );
}
