import { AskButton, ConnectButton } from "@/components/Buttons";
import { Heatmap, MonthLine, PaceChart } from "@/components/charts";
import { MonthSwitch } from "@/components/MonthSwitch";
import { SavingsGoalForm } from "@/components/SavingsGoalForm";
import { Mark } from "@/components/Wordmark";
import { BankTile } from "@/components/BankTile";
import { group } from "@/lib/categories";
import { addMonths, dayShort, monthName, monthShort, today, validYm, weekday, ymOf } from "@/lib/dates";
import { BRL } from "@/lib/format";
import { headline, notes } from "@/lib/insights";
import { pluggyConfigured } from "@/lib/pluggy";
import { hasData, overview, txsOfMonth } from "@/lib/queries";

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default async function Home({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  if (!(await hasData())) return <Welcome configured={pluggyConfigured()} />;
  const ym = validYm((await searchParams).m) ?? ymOf(today());
  const prevYm = addMonths(ym, -1);
  const [o, txs, prevTxs] = await Promise.all([overview(ym), txsOfMonth(ym), txsOfMonth(prevYm)]);
  const name = (process.env.USER_NAME ?? "Gabriel").split(" ")[0];
  const head = headline(o, name);
  const list = notes(o, txs, prevTxs);
  const diff = o.prevSpentSamePoint - o.spent;
  const income = o.spend.income;
  const free = Math.max(0, o.spend.free);
  const bankTotal = o.bank.reduce((s, a) => s + a.balance, 0);
  const limitTotal = o.cards.reduce((s, c) => s + (c.credit_limit ?? 0), 0);
  const available = o.cards.reduce((s, c) => s + (c.available_limit ?? 0), 0);
  const topGroups = o.groups.filter((g) => g.total > 0 || g.prev > 0).slice(0, 6);
  const gmax = Math.max(...topGroups.map((g) => Math.max(g.total, g.prev)), 1);
  const nextDue = o.cards.map((c) => c.due_date).filter(Boolean).sort()[0];

  return (
    <div className="bento">
      <div className="s12 screen-h" style={{ margin: 0 }}>
        <MonthSwitch ym={ym} path="/" />
      </div>

      <article className="p s5 spend">
        <div className="ph">
          <span className="lbl">{o.isCurrent ? "Pode gastar hoje" : `Sobrou em ${monthName(ym)}`}</span>
          {o.isCurrent && <AskButton q="Como você calculou quanto posso gastar por dia?">como calculei ↗</AskButton>}
        </div>
        <div className="v">{BRL(o.isCurrent ? o.spend.perDay : Math.max(0, o.income - o.spent))}</div>
        <p className="why">
          {o.isCurrent
            ? o.savingsGoal > 0
              ? `Por dia, até o dia ${o.spend.daysLeft + o.day - 1}, e você ainda guarda os ${BRL(o.savingsGoal)} da meta.`
              : "Por dia, até o fim do mês. Diga quanto quer guardar para eu descontar."
            : `Entrou ${BRL(o.income)} e saiu ${BRL(o.spent)}.`}
        </p>
        {income > 0 && (
          <>
            <div className="split" role="img" aria-label={`Renda: ${BRL(o.spent)} gasto, ${BRL(o.savingsGoal)} meta, ${BRL(free)} livre`}>
              <b style={{ flex: Math.min(o.spent, income), background: "var(--fg-3)" }} />
              {o.savingsGoal > 0 && <b style={{ flex: o.savingsGoal, background: "var(--mint-dim)", outline: "1px solid var(--mint)", outlineOffset: -1 }} />}
              {free > 0 && <b style={{ flex: free, background: "var(--mint)" }} />}
            </div>
            <div className="split-l">
              <span><i style={{ background: "var(--fg-3)" }} />Gasto {BRL(o.spent).replace(/,\d\d$/, "")}</span>
              {o.savingsGoal > 0 && <span><i style={{ background: "var(--mint-dim)", outline: "1px solid var(--mint)" }} />Meta {BRL(o.savingsGoal).replace(/,\d\d$/, "")}</span>}
              <span><i style={{ background: "var(--mint)" }} />Livre {BRL(free).replace(/,\d\d$/, "")}</span>
            </div>
          </>
        )}
        {o.isCurrent && <SavingsGoalForm current={o.savingsGoal} />}
        <div className="foot" style={{ paddingTop: 14 }}>
          <span>{o.income >= o.spend.income ? `Renda de ${monthName(ym)}` : "Renda esperada (média de 3 meses)"}</span>
          <b className="n" style={{ color: "var(--fg)" }}>{BRL(o.spend.income)}</b>
        </div>
      </article>

      <article className="p s7 greet">
        <h1>{head.title}</h1>
        <p className="lede">{head.lede}</p>
        <ul className="notes">
          {list.map((n) => (
            <li key={n.text}>
              <AskButton q={n.ask} className="">
                <i />
                <span>{n.text}</span>
                <span className="go">perguntar →</span>
              </AskButton>
            </li>
          ))}
        </ul>
        <div className="sign" style={{ marginTop: "auto" }}>
          <span><Mark />liu liu</span>
          <span>{dayShort(today())}</span>
        </div>
      </article>

      <article className="p s12 ml">
        <div className="ph">
          <span className="lbl">Linha do mês</span>
          <span className="faint" style={{ fontSize: 12 }}>cada barra é um dia, na cor da categoria em que você mais gastou</span>
        </div>
        <MonthLine daily={o.daily} dominant={o.dominant} today={o.day} monthShort={monthShort(ym)} income={o.incomeEvents} bills={o.billEvents} />
        <div className="legend">
          {o.groups.filter((g) => g.total > 0).map((g) => (
            <span key={g.key}><i className="sq" style={{ background: group(g.key).color }} />{group(g.key).name}{group(g.key).note && <span className="faint"> · nota de R$ {group(g.key).note}</span>}</span>
          ))}
        </div>
      </article>

      <article className="p s6">
        <div className="ph"><span className="lbl">Ritmo de gastos</span><a className="more" href={`/categorias?m=${ym}`}>ver categorias ↗</a></div>
        <div className="big">{BRL(Math.abs(diff))} <small>{diff >= 0 ? "abaixo" : "acima"}</small></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 12, color: "var(--fg-2)", flexWrap: "wrap" }}>
          {o.prevSpentSamePoint > 0 && <span className={`chg ${diff >= 0 ? "good" : "bad"}`}>{diff >= 0 ? "↘" : "↗"} {Math.abs(Math.round((o.spent / o.prevSpentSamePoint - 1) * 1000) / 10).toLocaleString("pt-BR")}%</span>}
          vs. {BRL(o.prevSpentSamePoint)} no mesmo dia de {monthName(addMonths(ym, -1))}
        </div>
        <PaceChart cum={o.cum} prevCum={o.prevCum} current={monthName(ym)} prevLabel={monthName(addMonths(ym, -1))} />
        <div className="legend"><span><i className="ln" />{monthName(ym)}</span><span><i className="ln dash" />{monthName(addMonths(ym, -1))}</span></div>
      </article>

      <article className="p s6">
        <div className="ph">
          <span className="lbl">Mapa de calor</span>
          <span className="scale">menos <i style={{ background: "var(--raise)" }} /><i style={{ background: "color-mix(in srgb,var(--mint) 25%,var(--raise))" }} /><i style={{ background: "color-mix(in srgb,var(--mint) 50%,var(--raise))" }} /><i style={{ background: "color-mix(in srgb,var(--mint) 75%,var(--raise))" }} /><i style={{ background: "var(--mint)" }} /> mais</span>
        </div>
        <div className="big">{BRL(o.day ? o.spent / o.day : 0)} <small>por dia, em média</small></div>
        {o.weekday.avg > 0 && <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 4 }}>Tirando moradia e parcelas, <b style={{ color: "var(--fg)" }}>{WEEKDAYS[o.weekday.index]}</b> é seu dia mais caro: {BRL(o.weekday.avg)} em média.</div>}
        <Heatmap daily={o.daily} firstWeekday={weekday(`${ym}-01`)} today={o.day} monthShort={monthShort(ym)} />
      </article>

      <article className="p s6">
        <div className="ph"><span className="lbl">Contas correntes</span><ConnectButton>+ conectar banco</ConnectButton></div>
        <div className="big">{BRL(bankTotal)} <small>saldo total</small></div>
        <div className="rows">
          {o.bank.map((a) => (
            <div className="row" key={a.id}>
              <BankTile name={a.institution ?? a.name} color={a.color} />
              <div className="grow"><div className="t1">{a.institution ?? a.name}</div><div className="t2">{a.subtype === "SAVINGS_ACCOUNT" ? "Poupança" : "Conta corrente"}</div></div>
              <span className="amt">{BRL(a.balance)}</span>
            </div>
          ))}
        </div>
        <div className="foot"><span>{o.bank.length} {o.bank.length === 1 ? "conta" : "contas"} · via Open Finance</span>{o.invested > 0 && <span>Investido: <b className="n" style={{ color: "var(--fg)" }}>{BRL(o.invested)}</b></span>}</div>
      </article>

      <article className="p s6">
        <div className="ph"><span className="lbl">Limite total disponível</span><a className="more" href="/cartoes">ver cartões ↗</a></div>
        <div className="big">{BRL(available)}</div>
        <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 4 }}>de {BRL(limitTotal)} de limite total</div>
        <div className="rows">
          {o.cards.map((c) => (
            <div className="row" key={c.id}>
              <BankTile name={c.institution ?? c.name} color={c.color} />
              <div className="grow">
                <div className="t1">{c.institution ?? c.name} {c.number ? `•••• ${c.number.slice(-4)}` : ""}</div>
                <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${c.credit_limit ? Math.min(100, (Math.abs(c.balance) / c.credit_limit) * 100) : 0}%`, background: "var(--fg-2)" }} /></div>
                <div className="t2" style={{ marginTop: 4 }}>{c.due_date ? `Vence ${dayShort(c.due_date)} · ` : ""}fatura {BRL(Math.abs(c.balance))}</div>
              </div>
              <div><div className="amt">{BRL(c.available_limit ?? 0)}</div><div className="t2" style={{ textAlign: "right" }}>disponível</div></div>
            </div>
          ))}
        </div>
        <div className="foot"><span>{o.cards.length} {o.cards.length === 1 ? "cartão" : "cartões"}</span>{nextDue && <span>Próxima fatura: {dayShort(nextDue)}</span>}</div>
      </article>

      <article className="p s7">
        <div className="ph"><span className="lbl">Principais categorias</span><a className="more" href={`/categorias?m=${ym}`}>ver todas ↗</a></div>
        <div className="wrapx">
          <table className="tbl">
            <thead><tr><th>Categoria</th><th className="r">Atual</th><th className="vs hide-s">vs. {monthName(addMonths(ym, -1))}</th><th className="r">Variação</th><th className="r hide-s">{monthName(addMonths(ym, -1))}</th></tr></thead>
            <tbody>
              {topGroups.map((g) => {
                const d = g.prev ? Math.round((g.total / g.prev - 1) * 100) : null;
                const cls = d === null ? "flat" : d === 0 ? "flat" : d > 0 ? "bad" : "good";
                return (
                  <tr key={g.key}>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><i className="cdot" style={{ background: group(g.key).color }} />{group(g.key).name}</span></td>
                    <td className="r n" style={{ fontWeight: 600 }}>{BRL(g.total)}</td>
                    <td className="vs hide-s"><div className="vsbar"><div className="prev" style={{ width: `${(g.prev / gmax) * 100}%` }} /><div className="cur" style={{ width: `calc(${(g.total / gmax) * 100}% - 2px)`, background: group(g.key).color }} /></div></td>
                    <td className="r"><span className={`chg ${cls}`}>{d === null ? "novo" : `${d > 0 ? "+" : ""}${d}%`}</span></td>
                    <td className="r n faint hide-s">{BRL(g.prev)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      <article className="p s5">
        <div className="ph"><span className="lbl">Próximos 14 dias</span><span className="faint" style={{ fontSize: 12 }}>{BRL(o.upcoming.reduce((s, u) => s + u.amount, 0))} a sair</span></div>
        <div className="rows">
          {o.upcoming.length === 0 && <p className="faint" style={{ margin: 0 }}>Nenhuma conta prevista. Faturas e contas que se repetem todo mês aparecem aqui.</p>}
          {o.upcoming.map((u) => (
            <div className="row" key={u.date + u.description}>
              <span className="mono faint" style={{ width: 48, flex: "none" }}>{dayShort(u.date)}</span>
              <div className="grow"><div className="t1">{u.description}</div><div className="t2">{u.detail}</div></div>
              <span className="amt">{BRL(u.amount)}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="p s12">
        <div className="ph"><span className="lbl">Metas</span><AskButton q="Quero criar uma meta de economia.">+ nova meta</AskButton></div>
        {o.goals.length === 0 ? (
          <p className="faint" style={{ margin: "12px 0 0" }}>Nenhuma meta ainda. Peça ao liu liu: “quero juntar R$ 10 mil para viajar até junho”.</p>
        ) : (
          <div className="goals3">
            {o.goals.map((g) => (
              <div className="row" key={g.id} style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span className="t1">{g.name}</span><span className="n" style={{ whiteSpace: "nowrap" }}><b>{BRL(g.saved)}</b> <span className="faint">/ {BRL(g.target)}</span></span></div>
                <div className="bar" style={{ margin: "7px 0 5px" }}><i style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} /></div>
                <div className="t2">{g.deadline ? `até ${dayShort(g.deadline)} ${g.deadline.slice(0, 4)}` : "sem prazo"}</div>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function Welcome({ configured }: { configured: boolean }) {
  return (
    <div className="p empty" style={{ marginTop: 24 }}>
      <Mark />
      <h2>Vamos conectar seus bancos</h2>
      <p>O liu liu lê suas contas e cartões pelo Open Finance, com acesso só de leitura. Escolha <b>MeuPluggy</b> na janela que abrir para trazer os bancos que você já conectou lá.</p>
      {configured ? (
        <ConnectButton className="btn pri">Conectar banco</ConnectButton>
      ) : (
        <p className="err">Falta configurar PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nas variáveis de ambiente.</p>
      )}
    </div>
  );
}
