"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// The Pluggy widget touches `window`, so it only loads in the browser.
const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((m) => m.PluggyConnect), { ssr: false });

type State =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "widget"; token: string; opened: boolean }
  | { step: "importing" }
  | { step: "done"; text: string }
  | { step: "error"; text: string };

const OPEN_TIMEOUT_MS = 12_000;

function log(step: string, detail?: string) {
  fetch("/api/client-log", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step, detail }), keepalive: true }).catch(() => {});
}

export function ConnectBank() {
  const router = useRouter();
  const [s, setS] = useState<State>({ step: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const open = async () => {
      setS({ step: "loading" });
      log("click");
      const r = await fetch("/api/pluggy/connect-token", { method: "POST" })
        .then(async (x) => ({ ok: x.ok, body: await x.json().catch(() => ({})) }))
        .catch((e) => ({ ok: false, body: { error: `Sem conexão: ${(e as Error).message}` } }));
      if (!r.ok || !r.body.accessToken) {
        log("token_error", r.body.error);
        setS({ step: "error", text: r.body.error ?? "Não deu para abrir a conexão." });
        return;
      }
      log("token_ok");
      setS({ step: "widget", token: r.body.accessToken, opened: false });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setS((cur) => {
          if (cur.step === "widget" && !cur.opened) {
            log("open_timeout");
            return { step: "error", text: "A janela da Pluggy não abriu. Isso costuma ser um bloqueador de anúncios ou de rastreadores barrando connect.pluggy.ai. Desative para este site (ou tente outro navegador) e clique de novo." };
          }
          return cur;
        });
      }, OPEN_TIMEOUT_MS);
    };
    window.addEventListener("liu:connect", open);
    return () => {
      window.removeEventListener("liu:connect", open);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const close = () => setS({ step: "idle" });

  if (s.step === "widget")
    return (
      <>
        <PluggyConnect
          connectToken={s.token}
          language="pt"
          onOpen={() => {
            log("open");
            setS((cur) => (cur.step === "widget" ? { ...cur, opened: true } : cur));
          }}
          onEvent={(e) => log("event", e.event)}
          onLoadError={(e) => {
            log("load_error", e.message);
            setS({ step: "error", text: `Não consegui carregar a janela da Pluggy: ${e.message}` });
          }}
          onClose={() => {
            log("close");
            close();
          }}
          onError={(e) => {
            log("error", e.message);
            setS({ step: "error", text: e.message });
          }}
          onSuccess={async ({ item }) => {
            log("success", item.connector?.name);
            setS({ step: "importing" });
            const r = await fetch("/api/pluggy/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: item.id }) })
              .then((x) => x.json())
              .catch(() => ({ error: "sem conexão" }));
            setS(r.ok ? { step: "done", text: `${item.connector.name} conectado. Importei ${r.transactions} transações de ${r.accounts} contas.` } : { step: "error", text: r.error ?? "A importação falhou." });
            router.refresh();
          }}
        />
        {!s.opened && (
          <div className="scrim">
            <div className="modal" role="status"><p className="muted" style={{ margin: 0 }}>Abrindo a janela da Pluggy…</p></div>
          </div>
        )}
      </>
    );

  if (s.step === "idle") return null;
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
