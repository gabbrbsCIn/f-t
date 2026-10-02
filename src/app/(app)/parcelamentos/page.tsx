import { BankTile } from "@/components/BankTile";
import { CommittedChart } from "@/components/charts";
import { group } from "@/lib/categories";
import { monthName, monthShort, today, ymOf } from "@/lib/dates";
import { BRL } from "@/lib/format";
import { accounts, expectedIncome, installmentsView } from "@/lib/queries";

export const metadata = { title: "Parcelamentos · liu liu" };

export default async function Installments() {
  const ym = ymOf(today());
  const [v, accs, income] = await Promise.all([installmentsView(ym), accounts(), expectedIncome(ym)]);
  const byId = new Map(accs.map((a) => [a.id, a]));
  const last = v.plans.reduce((m, p) => (p.endYm > m ? p.endYm : m), ym);
  const legend = [...new Map(v.plans.filter((p) => p.remaining > 0).map((p) => [p.group_key, p])).values()];
  return (
    <div className="bento">
      <article className="p s4">
        <span className="lbl">Em parcelas este mês</span>
        <div className="big">{BRL(v.thisMonth)}</div>
        {income > 0 && <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 4 }}>{((v.thisMonth / income) * 100).toFixed(1).replace(".", ",")}% da sua renda média</div>}
        <div className="foot" style={{ marginTop: 18 }}><span>Ainda a pagar</span><b className="n" style={{ color: "var(--fg)" }}>{BRL(v.stillToPay)}</b></div>
        <div className="foot" style={{ border: 0, paddingTop: 6, marginTop: 0 }}><span>Última parcela</span><b style={{ color: "var(--fg)" }}>{v.plans.length ? `${monthName(last)} de ${last.slice(0, 4)}` : "—"}</b></div>
      </article>
      <article className="p s8">
        <div className="ph"><span className="lbl">Quanto já está comprometido</span><span className="faint" style={{ fontSize: 12 }}>próximos 8 meses</span></div>
        <CommittedChart months={v.committed.map((c) => ({ label: monthShort(c.ym), total: c.total, items: c.items }))} />
        <div className="legend">
          {legend.map((p) => <span key={p.group_key}><i className="sq" style={{ background: group(p.group_key).color }} />{group(p.group_key).name}</span>)}
        </div>
      </article>
      <article className="p s12 plist">
        <div className="ph" style={{ padding: "16px 20px 6px" }}><span className="lbl">Compras parceladas ativas</span></div>
        {v.plans.length === 0 && <p className="faint" style={{ padding: "0 20px 16px", margin: 0 }}>Nenhuma compra parcelada no cartão. Quando houver, aparece aqui com quantas parcelas faltam.</p>}
        {v.plans.map((p) => {
          const a = byId.get(p.account_id);
          return (
            <div className="inst" key={p.key}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                <BankTile name={a?.institution ?? a?.name ?? "?"} color={a?.color ?? null} />
                <div style={{ minWidth: 0 }}><div className="t1">{p.description}</div><div className="t2">{a?.institution ?? ""} · {p.total}× de {BRL(p.value)}</div></div>
              </div>
              <div className="mid">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }} className="faint">
                  <span>parcela <b style={{ color: "var(--fg)" }}>{p.current} de {p.total}</b></span>
                  <span>{p.remaining === 0 ? "última parcela" : `termina em ${monthShort(p.endYm)}/${p.endYm.slice(0, 4)}`}</span>
                </div>
                <div className="segs">{Array.from({ length: p.total }, (_, i) => <i key={i} className={i < p.current - 1 ? "on" : i === p.current - 1 ? "now" : ""} />)}</div>
              </div>
              <div style={{ textAlign: "right" }}><div className="amt">{BRL(p.value)}</div><div className="t2">{p.remaining ? `${BRL(p.value * p.remaining)} a pagar` : "quitado"}</div></div>
            </div>
          );
        })}
      </article>
    </div>
  );
}
