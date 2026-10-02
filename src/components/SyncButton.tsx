"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";

function ago(iso: string | null) {
  if (!iso) return "nunca sincronizado";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "atualizado agora";
  if (min < 60) return `atualizado há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `atualizado há ${h} h`;
  return `atualizado há ${Math.round(h / 24)} d`;
}

export function SyncButton({ last, configured }: { last: string | null; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!configured) return <span className="sync faint">Pluggy não configurada</span>;
  return (
    <>
      <button
        className="syncbtn sync"
        disabled={busy}
        title="Buscar transações novas nos bancos"
        onClick={async () => {
          setBusy(true);
          const r = await fetch("/api/sync", { method: "POST" }).then((x) => x.json()).catch(() => ({ error: "sem conexão" }));
          setBusy(false);
          setMsg(r.error ? `Não deu para atualizar: ${r.error}` : r.errors?.length ? `Alguns bancos falharam: ${r.errors.join("; ")}` : `${r.transactions} transações conferidas`);
          setTimeout(() => setMsg(null), 4000);
          router.refresh();
        }}
      >
        <span className="dot" />
        {busy ? "atualizando…" : ago(last)}
        <Icon name="sync" size={13} />
      </button>
      {msg && <div className="toast" role="status">{msg}</div>}
    </>
  );
}
