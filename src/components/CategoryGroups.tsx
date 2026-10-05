"use client";
import Link from "next/link";
import { useState } from "react";
import { group, type GroupKey } from "@/lib/categories";
import { BRL } from "@/lib/format";
import { txHref } from "@/lib/txFilter";
import { Icon } from "./Icon";

export function CategoryGroups({ ym, groups, total }: { ym: string; groups: { key: GroupKey; total: number; subs: { label: string; total: number }[] }[]; total: number }) {
  const shown = groups.filter((g) => g.total > 0);
  const [open, setOpen] = useState<Set<string>>(new Set(shown.slice(0, 3).map((g) => g.key)));
  const max = shown[0]?.total ?? 1;
  if (!shown.length) return <p className="faint" style={{ padding: "0 20px 16px", margin: 0 }}>Nenhum gasto neste mês.</p>;
  return (
    <>
      {shown.map((g) => {
        const meta = group(g.key);
        const isOpen = open.has(g.key);
        return (
          <div key={g.key} className={`group ${isOpen ? "open" : ""}`}>
            <button
              className="gh"
              aria-expanded={isOpen}
              onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
            >
              <Icon name="chev" className="chev" />
              <span className="badge" style={{ background: meta.color }}>{meta.note ? `R$ ${meta.note}` : "···"}</span>
              <span className="nm">{meta.name}<span className="pc">{g.subs.length} {g.subs.length === 1 ? "subcategoria" : "subcategorias"} · {((g.total / total) * 100).toFixed(1).replace(".", ",")}%</span></span>
              <span className="amt" style={{ fontSize: 15 }}>{BRL(g.total)}</span>
              <span className="bar"><i style={{ width: `${(g.total / max) * 100}%`, background: meta.color }} /></span>
            </button>
            <div className="subs">
              {g.subs.map((s) => (
                <Link className="sub go sub-link" key={s.label} href={txHref({ ym, kind: "out", cats: [`${g.key}:${s.label}`] })} title={`Ver transações de ${s.label}`}>
                  <span className="t1" style={{ fontWeight: 400 }}>{s.label}</span>
                  <span className="amt">{BRL(s.total)}</span>
                  <span className="bar"><i style={{ width: `${(s.total / g.total) * 100}%`, background: `color-mix(in srgb, ${meta.color} 70%, transparent)` }} /></span>
                </Link>
              ))}
              <Link className="go-all" href={txHref({ ym, kind: "out", cats: [g.key] })}>Ver todas as transações de {meta.name} →</Link>
            </div>
          </div>
        );
      })}
    </>
  );
}
