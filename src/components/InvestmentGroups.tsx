"use client";
import { useState } from "react";
import { BRL } from "@/lib/format";
import type { PositionGroup } from "@/lib/investments";
import { Icon } from "./Icon";

const d = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");

function Gain({ balance, invested }: { balance: number; invested: number | null }) {
  if (invested == null || invested <= 0) return <span className="faint">—</span>;
  const g = balance - invested;
  return (
    <span className={g >= 0 ? "pos" : "neg"}>
      {g >= 0 ? "+" : "−"} {BRL(Math.abs(g))} <span className="faint">({((g / invested) * 100).toFixed(1).replace(".", ",")}%)</span>
    </span>
  );
}

export function InvestmentGroups({ groups }: { groups: PositionGroup[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  return (
    <>
      <div className="inv-row inv-head">
        <span />
        <span>Aplicação</span>
        <span className="r">Aplicado</span>
        <span className="r">Hoje</span>
        <span className="r hide-s">Rendimento</span>
        <span className="r hide-s">Próximo vencimento</span>
      </div>
      {groups.map((g) => {
        const isOpen = open.has(g.key);
        const many = g.items.length > 1;
        return (
          <div key={g.key} className="group">
            <button
              className="inv-row"
              aria-expanded={many ? isOpen : undefined}
              onClick={() => many && setOpen((s) => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
              style={{ cursor: many ? "pointer" : "default" }}
            >
              <span>{many ? <Icon name="chev" className={`chev ${isOpen ? "rot" : ""}`} /> : <i className="cdot" style={{ background: g.cls.color }} />}</span>
              <span style={{ minWidth: 0 }}>
                <span className="t1" style={{ display: "block" }}>{g.label}</span>
                <span className="t2">{g.rate}{many ? ` · ${g.items.length} aplicações` : ""}</span>
              </span>
              <span className="r n faint">{g.invested == null ? "—" : BRL(g.invested)}</span>
              <span className="r amt">{BRL(g.balance)}</span>
              <span className="r n hide-s"><Gain balance={g.balance} invested={g.invested} /></span>
              <span className="r n hide-s faint">{d(g.nextDue)}</span>
            </button>
            {isOpen &&
              g.items.map((i) => (
                <div key={i.id} className="inv-row inv-sub">
                  <span />
                  <span className="t2" style={{ color: "var(--fg-2)" }}>aplicado em {d(i.purchase_date)}</span>
                  <span className="r n faint">{i.invested == null ? "—" : BRL(i.invested)}</span>
                  <span className="r n">{BRL(i.balance)}</span>
                  <span className="r n hide-s"><Gain balance={i.balance} invested={i.invested} /></span>
                  <span className="r n hide-s faint">{d(i.due_date)}</span>
                </div>
              ))}
          </div>
        );
      })}
    </>
  );
}
