import { AskButton } from "@/components/Buttons";
import { HistoryChart, MaturityChart } from "@/components/charts";
import { InvestmentGroups } from "@/components/InvestmentGroups";
import { dayShort } from "@/lib/dates";
import { BRL } from "@/lib/format";
import { shortName } from "@/lib/investments";
import { investmentsView } from "@/lib/queries";

export const metadata = { title: "Investimentos · liu liu" };

export default async function Investments() {
  const v = await investmentsView();
  if (!v.groups.length)
    return (
      <div className="p empty">
        <h2>Nenhum investimento encontrado</h2>
        <p>Quando a sua conexão pelo MeuPluggy incluir investimentos (CDB, Tesouro, ações, fundos), eles aparecem aqui depois da próxima atualização.</p>
      </div>
    );
  const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
  return (
    <div className="bento">
      <article className="p s5">
        <div className="ph"><span className="lbl">Investido hoje</span><AskButton q="Como estão meus investimentos?">perguntar ↗</AskButton></div>
        <div className="big">{BRL(v.total)}</div>
        <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 4 }}>líquido de IR estimado · bruto {BRL(v.gross)}</div>
        {v.investedKnown > 0 && (
          <div className="rows" style={{ marginTop: 18 }}>
            <div className="row"><span className="grow muted">Você aplicou</span><span className="amt">{BRL(v.investedKnown)}</span></div>
            <div className="row">
              <span className="grow muted">Rendeu até agora</span>
              <span className={`amt ${v.profitKnown >= 0 ? "pos" : "neg"}`}>{v.profitKnown >= 0 ? "+ " : "− "}{BRL(Math.abs(v.profitKnown))} <span className="faint" style={{ fontWeight: 400 }}>({pct(v.profitPct)})</span></span>
            </div>
          </div>
        )}
        <div className="foot">
          <span>{v.coverage < 0.999 ? "Ações e ETFs não informam o valor aplicado" : "Valores líquidos do IR estimado"}</span>
          {v.next && <span>Próximo vencimento: {dayShort(v.next.due_date!)} {v.next.due_date!.slice(0, 4)}</span>}
        </div>
      </article>

      <article className="p s7">
        <div className="ph"><span className="lbl">Onde está o dinheiro</span><span className="faint" style={{ fontSize: 12 }}>{v.groups.reduce((s, g) => s + g.items.length, 0)} aplicações</span></div>
        <div className="ruler" style={{ marginTop: 18 }}>
          {v.byClass.map((c) => <i key={c.key} style={{ flex: c.total, background: c.color }} title={`${c.name} · ${BRL(c.total)}`} />)}
        </div>
        <div className="rows">
          {v.byClass.map((c) => (
            <div className="row" key={c.key}>
              <i className="cdot" style={{ background: c.color }} />
              <span className="grow t1">{c.name}</span>
              <span className="faint n" style={{ fontSize: 12.5 }}>{pct(c.total / v.total)}</span>
              <span className="amt" style={{ minWidth: 110 }}>{BRL(c.total)}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="p s7">
        <div className="ph"><span className="lbl">Quando o dinheiro fica livre</span><span className="faint" style={{ fontSize: 12 }}>por ano de vencimento</span></div>
        <MaturityChart years={v.maturities} noDue={v.noDue} />
        {v.next && <p className="faint" style={{ fontSize: 12.5, margin: "8px 0 0" }}>O próximo a vencer é {shortName(v.next)} ({BRL(v.next.balance)}) em {dayShort(v.next.due_date!)} de {v.next.due_date!.slice(0, 4)}.</p>}
      </article>

      <article className="p s5">
        <div className="ph"><span className="lbl">Evolução</span><span className="faint" style={{ fontSize: 12 }}>total investido</span></div>
        {v.history.length >= 2 ? (
          <HistoryChart points={v.history} />
        ) : (
          <p className="faint" style={{ margin: "14px 0 0", maxWidth: "46ch" }}>
            O histórico começa {v.history[0] ? `em ${dayShort(v.history[0].day)}` : "na próxima atualização"}. A cada atualização eu guardo o total do dia, e a curva aparece aqui a partir do segundo dia.
          </p>
        )}
      </article>

      <article className="p s12 plist">
        <div className="ph" style={{ padding: "16px 20px 8px" }}><span className="lbl">Aplicações</span><span className="faint" style={{ fontSize: 12 }}>toque para ver cada compra</span></div>
        <InvestmentGroups groups={v.groups} />
      </article>
    </div>
  );
}
