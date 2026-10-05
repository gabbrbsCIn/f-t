export type InvestmentRow = {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  balance: number;
  gross: number | null;
  invested: number | null;
  rate: number | null;
  rate_type: string | null;
  fixed_rate: number | null;
  due_date: string | null;
  purchase_date: string | null;
  issuer: string | null;
  code: string | null;
};

export type AssetClass = { key: string; name: string; color: string };

export const CLASSES: AssetClass[] = [
  { key: "rf", name: "CDB e renda fixa", color: "var(--c-moradia)" },
  { key: "tesouro", name: "Tesouro Direto", color: "var(--c-transp)" },
  { key: "acoes", name: "Ações e ETFs", color: "var(--c-lazer)" },
  { key: "fundos", name: "Fundos", color: "var(--c-saude)" },
  { key: "prev", name: "Previdência", color: "var(--c-compras)" },
  { key: "outros", name: "Outros", color: "var(--c-outros)" },
];

export function classOf(i: Pick<InvestmentRow, "type" | "subtype">): AssetClass {
  const t = (i.type ?? "").toUpperCase(), s = (i.subtype ?? "").toUpperCase();
  const key =
    s === "TREASURY" ? "tesouro"
    : t === "FIXED_INCOME" ? "rf"
    : t === "EQUITY" || t === "ETF" || s === "STOCK" || s === "ETF" || s === "REAL_ESTATE_FUND" ? "acoes"
    : t === "MUTUAL_FUND" ? "fundos"
    : t === "SECURITY" || s.includes("PENSION") || s.includes("RETIREMENT") ? "prev"
    : "outros";
  return CLASSES.find((c) => c.key === key)!;
}

const title = (s: string) => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** "CDB - NU FINANCEIRA S.A. - SOCIEDADE DE ..." → "CDB Nu Financeira". */
export function shortName(i: Pick<InvestmentRow, "name" | "code" | "type">): string {
  if ((i.type ?? "").toUpperCase() === "EQUITY" && i.code) return i.code;
  const m = i.name.match(/^(CDB|LCI|LCA|LC|LIG|CRI|CRA|DEB[EÊ]NTURE)\s*[-–]\s*(.+)$/i);
  if (m) {
    const issuer = m[2].split(/\s+[-–]\s+|,/)[0].replace(/\b(S\.?A\.?|LTDA|SOCIEDADE.*)$/i, "").trim();
    return `${m[1].toUpperCase()} ${title(issuer)}`.replace(/\s+/g, " ").trim();
  }
  return i.name.length > 48 ? `${i.name.slice(0, 46)}…` : i.name;
}

const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Human rate: "100% do CDI", "IPCA + 7,62%", "Selic + 0,07%", "12,5% a.a.". */
export function rateLabel(i: Pick<InvestmentRow, "rate" | "rate_type" | "fixed_rate" | "type">): string {
  const rt = (i.rate_type ?? "").toUpperCase();
  if (rt === "CDI") return i.fixed_rate ? `CDI + ${num(i.fixed_rate)}%` : `${num(i.rate ?? 100)}% do CDI`;
  if (rt === "IPCA") return `IPCA + ${num(i.fixed_rate ?? i.rate ?? 0)}%`;
  if (rt === "SELIC") return i.rate ? `Selic + ${num(i.rate)}%` : "Selic";
  if (rt === "PRE" || rt === "PREFIXADO") return `${num(i.fixed_rate ?? i.rate ?? 0)}% a.a.`;
  if ((i.type ?? "").toUpperCase() === "EQUITY") return "Renda variável";
  return rt ? title(rt) : "—";
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export type PositionGroup = {
  key: string;
  label: string;
  rate: string;
  cls: AssetClass;
  balance: number;
  invested: number | null;
  nextDue: string | null;
  items: (InvestmentRow & { short: string })[];
};

/** Positions grouped by class, product and rate (eleven buys of the same CDB become one line). */
export function summarize(rows: InvestmentRow[], today: string) {
  const groups = new Map<string, PositionGroup>();
  for (const i of rows) {
    const cls = classOf(i), short = shortName(i);
    const key = `${cls.key}|${short}|${(i.rate_type ?? "").toUpperCase()}`;
    const g = groups.get(key) ?? { key, label: short, rate: "", cls, balance: 0, invested: 0, nextDue: null, items: [] };
    g.balance = r2(g.balance + i.balance);
    g.invested = g.invested == null || i.invested == null ? null : r2(g.invested + i.invested);
    if (i.due_date && i.due_date >= today && (!g.nextDue || i.due_date < g.nextDue)) g.nextDue = i.due_date;
    g.items.push({ ...i, short });
    groups.set(key, g);
  }
  const list = [...groups.values()]
    .map((g) => ({ ...g, rate: groupRate(g.items), items: g.items.sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9")) }))
    .sort((a, b) => b.balance - a.balance);

  const total = r2(rows.reduce((s, i) => s + i.balance, 0));
  const gross = r2(rows.reduce((s, i) => s + (i.gross ?? i.balance), 0));
  const known = rows.filter((i) => i.invested != null);
  const investedKnown = r2(known.reduce((s, i) => s + (i.invested ?? 0), 0));
  const balanceKnown = r2(known.reduce((s, i) => s + i.balance, 0));

  const byClass = CLASSES.map((c) => ({ ...c, total: r2(rows.filter((i) => classOf(i).key === c.key).reduce((s, i) => s + i.balance, 0)) })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  const years = new Map<string, number>();
  let noDue = 0;
  for (const i of rows) {
    if (i.due_date && i.due_date >= today) years.set(i.due_date.slice(0, 4), (years.get(i.due_date.slice(0, 4)) ?? 0) + i.balance);
    else noDue += i.balance;
  }
  const maturities = [...years.entries()].sort().map(([year, v]) => ({ year, total: r2(v) }));
  const next = rows.filter((i) => i.due_date && i.due_date >= today).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0] ?? null;

  return {
    total,
    gross,
    investedKnown,
    profitKnown: r2(balanceKnown - investedKnown),
    profitPct: investedKnown ? (balanceKnown - investedKnown) / investedKnown : 0,
    coverage: total ? balanceKnown / total : 0,
    byClass,
    groups: list,
    maturities,
    noDue: r2(noDue),
    next,
  };
}

/** One rate when every buy has the same; otherwise the range, e.g. "Selic + 0,07% a 0,09%". */
export function groupRate(items: Pick<InvestmentRow, "rate" | "rate_type" | "fixed_rate" | "type">[]): string {
  const labels = [...new Set(items.map(rateLabel))];
  if (labels.length === 1) return labels[0];
  const rt = (items[0].rate_type ?? "").toUpperCase();
  const field = rt === "IPCA" || rt === "PRE" || rt === "PREFIXADO" ? "fixed_rate" : "rate";
  const vals = items.map((i) => i[field]).filter((v): v is number => v != null).sort((a, b) => a - b);
  if (!vals.length) return labels[0];
  const lo = rateLabel({ ...items[0], [field]: vals[0] });
  const hi = num(vals[vals.length - 1]);
  return rt === "CDI" && field === "rate" ? `${num(vals[0])}% a ${hi}% do CDI` : `${lo} a ${hi}%`;
}
