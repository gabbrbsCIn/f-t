import { BillsChart } from "@/components/charts";
import { dayShort, monthShort, today, ymOf } from "@/lib/dates";
import { BRL } from "@/lib/format";
import { cardsView } from "@/lib/queries";
import { txHref } from "@/lib/txFilter";
import Link from "next/link";

export const metadata = { title: "Cartões · liu liu" };

export default async function Cards() {
  const cards = await cardsView();
  const holder = (process.env.USER_NAME ?? "Gabriel").toUpperCase();
  if (!cards.length) return <div className="p empty"><h2>Nenhum cartão conectado</h2><p>Os cartões de crédito dos bancos conectados aparecem aqui, com limite, fatura e datas.</p></div>;
  return (
    <div className="bento">
      {cards.map(({ card: c, bills, nextCommitted }) => {
        const fat = Math.abs(c.balance);
        const color = c.color ?? "#3a4a5c";
        const currentBill = bills.find((b) => c.due_date && b.due_date === c.due_date);
        const hist = bills.map((b) => ({ label: monthShort(ymOf(b.due_date)), total: b.total_amount, current: b === currentBill }));
        if (!currentBill && c.due_date) hist.push({ label: monthShort(ymOf(c.due_date)), total: fat, current: true });
        return (
          <article className="p s6 cc" key={c.id}>
            <div className="plastic" style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, #000))` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="pb">{c.institution ?? c.name}</span><span className="chip" /></div>
              <div>
                <div className="pn">•••• •••• •••• {c.number?.slice(-4) ?? "····"}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
                  <div><div style={{ fontSize: 11, opacity: 0.75 }}>disponível</div><div className="n" style={{ fontWeight: 700, fontSize: 22, fontStretch: "80%" }}>{BRL(c.available_limit ?? 0)}</div></div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>{holder}</div>
                </div>
              </div>
            </div>
            {c.credit_limit ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }} className="faint"><span>Limite usado</span><span className="n">{BRL(c.credit_limit - (c.available_limit ?? 0))} de {BRL(c.credit_limit)}</span></div>
                <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, ((c.credit_limit - (c.available_limit ?? 0)) / c.credit_limit) * 100)}%` }} /></div>
              </div>
            ) : null}
            <div className="kv">
              <div><div className="k">Fatura atual</div><div className="v">{BRL(fat)}</div></div>
              <div><div className="k">Fecha</div><div className="v">{c.close_date ? dayShort(c.close_date) : "—"}</div></div>
              <div><div className="k">Vence</div><div className="v">{c.due_date ? dayShort(c.due_date) : "—"}</div></div>
            </div>
            <div className="foot" style={{ marginTop: 0 }}>
              <span>Compras deste cartão</span>
              <Link className="more" href={txHref({ ym: ymOf(today()), accounts: [c.id] })}>ver transações ↗</Link>
            </div>
            <div>
              <div className="ph"><span className="lbl">Últimas faturas</span><span className="faint" style={{ fontSize: 12 }}>tracejado: já comprometido</span></div>
              <BillsChart bills={hist} next={nextCommitted && nextCommitted.total > 0 ? { label: monthShort(nextCommitted.ym), total: nextCommitted.total } : null} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
