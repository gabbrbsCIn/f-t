"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { Mark } from "./Wordmark";

type Msg = { role: "user" | "assistant"; text: string; time: string; error?: boolean };
type Conv = { id: string; title: string; updated_at: string; messages: number };

/** Postgres text timestamps ("2026-10-03 00:12:34.1+00") into something Date understands. */
const parseTs = (s: string) => new Date(s.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));

const newId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function when(iso: string) {
  const d = parseTs(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same ? `hoje, ${hhmm(d)}` : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const SUGGESTIONS = [
  "Como está o mês até agora?",
  "Quanto gastei com delivery esse mês?",
  "Quanto posso gastar por dia até o fim do mês?",
  "Como está a fatura do cartão?",
];

const hhmm = (d = new Date()) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ChatDrawer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<string | null>(null);
  const [conv, setConv] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [panel, setPanel] = useState<"chat" | "history">("chat");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async (id?: string) => {
    const r = await fetch(`/api/chat${id ? `?c=${encodeURIComponent(id)}` : ""}`).then((x) => x.json()).catch(() => ({ messages: [], conversations: [] }));
    setConv(r.conversation ?? id ?? newId());
    setConvs(r.conversations ?? []);
    setMsgs((r.messages ?? []).map((m: { role: Msg["role"]; display: string; created_at: string }) => ({ role: m.role, text: m.display, time: hhmm(parseTs(m.created_at)) })));
  }, []);

  const startNew = () => {
    setConv(newId());
    setMsgs([]);
    setPanel("chat");
    setConfirmDelete(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removeCurrent = async () => {
    if (conv) await fetch(`/api/chat?c=${encodeURIComponent(conv)}`, { method: "DELETE" }).catch(() => {});
    setConvs((cs) => cs.filter((c) => c.id !== conv));
    startNew();
  };

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setBusy(true);
      setMsgs((m) => [...(m ?? []), { role: "user", text: q, time: hhmm() }]);
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, conversation: conv }) })
        .then(async (x) => ({ ok: x.ok, body: await x.json().catch(() => ({})) }))
        .catch(() => ({ ok: false, body: { error: "Sem conexão." } }));
      setBusy(false);
      if (r.ok) {
        setMsgs((m) => [...(m ?? []), { role: "assistant", text: r.body.reply, time: hhmm() }]);
        if (r.body.conversation) setConv(r.body.conversation);
        if (r.body.changed) router.refresh();
      } else {
        setMsgs((m) => [...(m ?? []), { role: "assistant", text: r.body.error ?? "Não consegui responder agora.", time: hhmm(), error: true }]);
      }
    },
    [busy, router, conv],
  );

  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent<string | null>).detail;
      setOpen(true);
      if (text) pending.current = text;
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement?.tagName ?? ""));
      if (e.key === "/" && !open && !typing) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("liu:ask", onAsk);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("liu:ask", onAsk);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (msgs === null) {
      load();
      return;
    }
    if (pending.current) {
      const t = pending.current;
      pending.current = null;
      send(t);
    }
    inputRef.current?.focus();
  }, [open, msgs, load, send]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, busy, open]);

  const asked = new Set((msgs ?? []).filter((m) => m.role === "user").map((m) => m.text.trim().toLowerCase()));

  return (
    <>
      {!open && (
        <button className="ask" onClick={() => setOpen(true)}>
          <Mark />
          Conversar com o liu liu <kbd>/</kbd>
        </button>
      )}
      <aside className="drawer" hidden={!open} aria-label="Conversa com o liu liu">
        <div className="dh">
          <Mark />
          <div>
            <div style={{ fontWeight: 600 }}>liu liu</div>
            <div className="sub2"><span className="dot" />lê suas contas pelo Open Finance</div>
          </div>
          <div className="dh-actions">
            <button className="x" onClick={startNew} aria-label="Nova conversa" title="Nova conversa"><Icon name="plus" /></button>
            <button className="x" onClick={() => { setPanel(panel === "history" ? "chat" : "history"); setConfirmDelete(false); }} aria-pressed={panel === "history"} aria-label="Conversas anteriores" title="Conversas anteriores"><Icon name="history" /></button>
            <button className="x" onClick={() => setConfirmDelete((v) => !v)} disabled={!msgs?.length} aria-label="Apagar esta conversa" title="Apagar esta conversa"><Icon name="trash" /></button>
            <button className="x" onClick={() => setOpen(false)} aria-label="Fechar conversa" title="Fechar"><Icon name="close" /></button>
          </div>
        </div>
        {confirmDelete && (
          <div className="confirm-bar" role="alert">
            <span>Apagar esta conversa? Os gastos que ela registrou continuam salvos.</span>
            <button className="btn" onClick={() => setConfirmDelete(false)}>Cancelar</button>
            <button className="btn danger" onClick={removeCurrent}>Apagar</button>
          </div>
        )}
        {panel === "history" && (
          <div className="msgs conv-list">
            <button className="conv new" onClick={startNew}><Icon name="plus" size={14} /> Nova conversa</button>
            {convs.length === 0 && <p className="faint" style={{ margin: 0 }}>Nenhuma conversa anterior.</p>}
            {convs.map((c) => (
              <button key={c.id} className={`conv ${c.id === conv ? "on" : ""}`} onClick={() => { setPanel("chat"); setMsgs(null); load(c.id); }}>
                <span className="t1">{c.title}</span>
                <span className="t2">{when(c.updated_at)} · {c.messages} mensagens</span>
              </button>
            ))}
          </div>
        )}
        <div className="msgs" ref={listRef} hidden={panel !== "chat"}>
          {msgs === null && <div className="m bot faint">Carregando…</div>}
          {msgs?.length === 0 && (
            <div className="m bot">
              <p>Oi! Pergunte qualquer coisa sobre seu dinheiro, ou me conte um gasto (“almoço 42 no débito”) que eu anoto.</p>
            </div>
          )}
          {msgs?.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="m me">{m.text}</div>
            ) : (
              <div key={i} className="m bot">
                {m.error ? <p className="err">{m.text}</p> : <Markdown text={m.text} />}
                <div className="tm">{m.time}</div>
              </div>
            ),
          )}
          {busy && (
            <div className="m bot" aria-live="polite">
              <span className="typing"><i /><i /><i /></span>
            </div>
          )}
        </div>
        <div className="sugs" hidden={panel !== "chat"}>
          {SUGGESTIONS.filter((s) => !asked.has(s.toLowerCase())).slice(0, 3).map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy}>{s}</button>
          ))}
        </div>
        <form
          hidden={panel !== "chat"}
          className="comp"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
            setInput("");
          }}
        >
          <input id="comp-in" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" placeholder="Pergunte ou anote: “almoço 42 no débito”" maxLength={2000} />
          <button className="send" aria-label="Enviar" disabled={busy}><Icon name="send" /></button>
        </form>
      </aside>
    </>
  );
}
