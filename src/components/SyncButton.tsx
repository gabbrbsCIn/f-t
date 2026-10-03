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

type SyncResponse = {
  error?: string;
  errors?: string[];
  transactions?: number;
  refresh?: { name: string; requested: boolean; reason?: string }[];
  nextAuto?: string | null;
};

function describe(r: SyncResponse): string {
  if (r.error) return `Não deu para atualizar: ${r.error}`;
  const parts = [`${r.transactions ?? 0} transações conferidas.`];
  const asked = (r.refresh ?? []).filter((x) => x.requested).map((x) => x.name);
  if (asked.length) parts.push(`Pedi dados novos a ${asked.join(", ")}: chegam em alguns minutos e entram sozinhos.`);
  if ((r.refresh ?? []).some((x) => !x.requested && /meu ?pluggy/i.test(x.name))) {
    const when = r.nextAuto ? new Date(r.nextAuto).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : null;
    parts.push(`O MeuPluggy atualiza sozinho uma vez por dia${when ? ` (próxima: ${when})` : ""}, e o liu liu importa assim que terminar.`);
  }
  if (r.errors?.length) parts.push(`Falhou: ${r.errors.join("; ")}`);
  return parts.join(" ");
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
          setMsg(describe(r));
          setTimeout(() => setMsg(null), 9000);
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
