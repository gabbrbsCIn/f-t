"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { group, type GroupKey } from "@/lib/categories";
import { BRL, BRLk } from "@/lib/format";
import { txHref } from "@/lib/txFilter";
import { useTip } from "./useTip";

const dayOf = (ym: string, d: number) => `${ym}-${String(d).padStart(2, "0")}`;

/** SVG <a> elements navigate inside the app instead of reloading the page. */
function useSvgLinks() {
  const router = useRouter();
  return (e: React.MouseEvent) => {
    const a = (e.target as Element).closest("a");
    const href = a?.getAttribute("href");
    if (!href?.startsWith("/") || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    router.push(href);
  };
}

function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Cumulative spending this month (solid) against last month (dashed). */
export function PaceChart({ cum, prevCum, current, prevLabel }: { cum: number[]; prevCum: number[]; current: string; prevLabel: string }) {
  const W = 440, H = 190, L = 48, R = 8, T = 10, B = 22;
  const days = Math.max(prevCum.length, 30);
  const hi = niceMax(Math.max(...cum, ...prevCum, 1));
  const x = (d: number) => L + ((d - 1) * (W - L - R)) / (days - 1);
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / hi;
  const path = (a: number[]) => (a.length ? "M" + a.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join("L") : "");
  const [hover, setHover] = useState<number | null>(null);
  const tip = useTip();
  const d = hover ?? cum.length;
  const ticks = [0, hi / 4, hi / 2, (3 * hi) / 4, hi];
  return (
    <div className="chart" ref={tip.ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Gasto acumulado: ${current} ${BRL(cum[cum.length - 1] ?? 0)} até o dia ${cum.length}`}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const day = Math.max(1, Math.min(days, Math.round((((e.clientX - r.left) * W) / r.width - L) / ((W - L - R) / (days - 1))) + 1));
          setHover(day);
          const v = cum[day - 1] ?? prevCum[day - 1] ?? 0;
          tip.setTip({ x: (x(day) * r.width) / W, y: (y(v) * r.height) / H, text: [`Dia ${day}`, cum[day - 1] != null ? `${current}: ${BRL(cum[day - 1])}` : null, prevCum[day - 1] != null ? `${prevLabel}: ${BRL(prevCum[day - 1])}` : null].filter(Boolean).join("\n") });
        }}
        onPointerLeave={() => {
          setHover(null);
          tip.onLeave();
        }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line className="gl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="ax" x={L - 8} y={y(v) + 3.5} textAnchor="end">{v ? BRLk(v) : "R$ 0"}</text>
          </g>
        ))}
        {[1, 8, 15, 22, days].map((t) => (
          <text key={t} className="ax" x={x(t)} y={H - 4} textAnchor="middle">{t}</text>
        ))}
        <path d={path(prevCum)} fill="none" stroke="var(--fg-3)" strokeWidth={1.6} strokeDasharray="4 4" />
        <path d={path(cum)} fill="none" stroke="var(--mint)" strokeWidth={2} strokeLinejoin="round" />
        {hover && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--fg-3)" />}
        {cum[d - 1] != null && <circle r={4.5} fill="var(--mint)" stroke="var(--panel)" strokeWidth={2} cx={x(d)} cy={y(cum[d - 1])} />}
      </svg>
      {tip.node}
    </div>
  );
}

/** One bar per day, colored by the group with the most spending that day; income and bills marked as events. */
export function MonthLine(p: {
  ym: string;
  daily: number[];
  dominant: (GroupKey | null)[];
  today: number;
  monthShort: string;
  income: { day: number; label: string; amount: number }[];
  bills: { day: number; label: string }[];
}) {
  const W = 1100, H = 206, L = 6, R = 6, base = 150, topY = 40;
  const n = p.daily.length;
  const step = (W - L - R) / n, bw = Math.max(4, step - 8);
  const nonzero = p.daily.slice(0, p.today).filter((v) => v > 0).sort((a, b) => a - b);
  const median = nonzero[Math.floor(nonzero.length / 2)] ?? 100;
  const cap = Math.max(300, niceMax(median * 3));
  const y = (v: number) => base - (Math.min(v, cap) / cap) * (base - topY);
  const tip = useTip();
  // Collapse income on the same day into one marker.
  const inc = new Map<number, number>();
  p.income.forEach((e) => inc.set(e.day, (inc.get(e.day) ?? 0) + e.amount));
  let lastBillX = -999, billRow = 0;
  const go = useSvgLinks();
  return (
    <div className="chart" ref={tip.ref} onPointerOver={tip.onOver} onPointerLeave={tip.onLeave} onClick={go}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gasto por dia no mês, com entradas e vencimentos marcados. Clique num dia para ver as transações.">
        <line className="gl" x1={L} x2={W - R} y1={base} y2={base} />
        {p.daily.map((v, i) => {
          const d = i + 1, x = L + i * step + (step - bw) / 2, cx = x + bw / 2;
          const g = p.dominant[i];
          if (d > p.today) return <rect key={d} x={x} y={base - 14} width={bw} height={14} rx={3} fill="none" stroke="var(--line-2)" strokeDasharray="3 3" />;
          if (!v || !g) return null;
          const yy = y(v), over = v > cap;
          return (
            <a key={d} href={txHref({ from: dayOf(p.ym, d), kind: "out" })} aria-label={`Dia ${d}: ${BRL(v)}`}>
              <rect x={x - (step - bw) / 2} y={topY - 10} width={step} height={base - topY + 10} fill="transparent" />
              <path className="hit" d={`M${x},${base}V${yy + 3}q0,-3 3,-3h${bw - 6}q3,0 3,3V${base}Z`} fill={group(g).color} data-t={`${String(d).padStart(2, "0")} ${p.monthShort} · ${BRL(v)}\nmais em ${group(g).name}\nclique para ver as transações`} />
              {over && (
                <>
                  <path d={`M${x - 1},${yy + 12}l${bw + 2},-5v5l-${bw + 2},5z`} fill="var(--panel)" />
                  <text className="ax" x={cx} y={yy - 5} textAnchor="middle" style={{ fill: "var(--fg-2)" }}>{BRLk(v)}</text>
                </>
              )}
            </a>
          );
        })}
        {[...inc.entries()].map(([d, amount]) => {
          const cx = L + (d - 1) * step + step / 2;
          return (
            <a key={`in${d}`} href={txHref({ from: dayOf(p.ym, d), kind: "in" })} aria-label={`Entrada no dia ${d}`}>
              <path d={`M${cx},8l5,7h-10z`} fill="var(--pos)" data-t={`${String(d).padStart(2, "0")} ${p.monthShort} · entrou ${BRL(amount)}`} />
              <text className="ax" x={cx + 8} y={16} style={{ fill: "var(--pos)", fontWeight: 600 }}>+ {BRL(amount).replace(",00", "")}</text>
              <line x1={cx} x2={cx} y1={18} y2={base} stroke="var(--pos)" strokeDasharray="2 4" opacity={0.6} />
            </a>
          );
        })}
        {p.bills.map((b) => {
          const cx = L + (b.day - 1) * step + step / 2;
          billRow = cx - lastBillX < 90 ? billRow + 1 : 0;
          lastBillX = cx;
          const dy = billRow * 13;
          return (
            <g key={`b${b.day}${b.label}`}>
              <line x1={cx} x2={cx} y1={base + 4} y2={base + 20 + dy} stroke="var(--fg-3)" />
              <text className="ax" x={cx} y={base + 30 + dy} textAnchor="middle" style={{ fill: "var(--fg-2)" }}>{b.label}</text>
            </g>
          );
        })}
        {[1, 8, 15, 22, p.today].filter((d, i, a) => d <= n && a.indexOf(d) === i).map((d) => (
          <text key={`t${d}`} className="ax" x={L + (d - 1) * step + step / 2} y={base + 14} textAnchor="middle">{d === p.today ? "hoje" : d}</text>
        ))}
      </svg>
      {tip.node}
    </div>
  );
}

export function Heatmap({ ym, daily, firstWeekday, today, monthShort }: { ym: string; daily: number[]; firstWeekday: number; today: number; monthShort: string }) {
  const tip = useTip();
  const past = daily.slice(0, today).filter((v) => v > 0).sort((a, b) => b - a);
  const max = past[Math.min(2, past.length - 1)] ?? 1; // third-highest day, so one huge bill doesn't flatten the rest
  const shade = (l: number) => ["var(--raise)", "color-mix(in srgb,var(--mint) 25%,var(--raise))", "color-mix(in srgb,var(--mint) 50%,var(--raise))", "color-mix(in srgb,var(--mint) 75%,var(--raise))", "var(--mint)"][l];
  return (
    <div className="chart" ref={tip.ref} onPointerOver={tip.onOver} onPointerLeave={tip.onLeave} style={{ marginTop: 4 }}>
      <div className="cal">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i} className="wd">{d}</div>)}
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`x${i}`} className="d x" />)}
        {daily.map((v, i) => {
          const d = i + 1;
          if (d > today) return <div key={d} className="d fut">{d}</div>;
          const l = v > 0 ? Math.max(1, Math.min(4, Math.ceil((v / max) * 4))) : 0;
          return (
            <Link key={d} href={txHref({ from: dayOf(ym, d), kind: "out" })} className={`d ${l >= 3 ? "hot" : ""} ${d === today ? "today" : ""}`} style={{ background: shade(l) }} data-t={`${String(d).padStart(2, "0")} ${monthShort} · ${BRL(v)}`} aria-label={`Dia ${d}: ${BRL(v)}. Ver transações`}>
              {d}
            </Link>
          );
        })}
      </div>
      {tip.node}
    </div>
  );
}

/** Proportion bar of the month's spending by group. */
export function Ruler({ ym, groups, total }: { ym: string; groups: { key: GroupKey; total: number }[]; total: number }) {
  const tip = useTip();
  const shown = groups.filter((g) => g.total > 0);
  return (
    <>
      <div className="chart" ref={tip.ref} onPointerOver={tip.onOver} onPointerLeave={tip.onLeave} style={{ marginTop: 0 }}>
        <div className="ruler">
          {shown.map((g) => (
            <Link key={g.key} href={txHref({ ym, kind: "out", cats: [g.key] })} style={{ flex: g.total, background: group(g.key).color }} data-t={`${group(g.key).name} · ${BRL(g.total)} · ${((g.total / total) * 100).toFixed(1).replace(".", ",")}%`} aria-label={`${group(g.key).name}: ver transações`} />
          ))}
        </div>
        {tip.node}
      </div>
      <div className="legend" style={{ marginTop: 0 }}>
        {shown.map((g) => (
          <Link key={g.key} href={txHref({ ym, kind: "out", cats: [g.key] })} className="legend-link"><i className="sq" style={{ background: group(g.key).color }} />{group(g.key).name} <span className="faint n">{Math.round((g.total / total) * 100)}%</span></Link>
        ))}
      </div>
    </>
  );
}

/** Installments already committed in the coming months, stacked per purchase. */
export function CommittedChart({ months }: { months: { label: string; total: number; items: { key: string; description: string; group_key: string; value: number }[] }[] }) {
  const tip = useTip();
  const W = 560, H = 180, L = 46, R = 6, T = 16, B = 22;
  const hi = niceMax(Math.max(...months.map((m) => m.total), 100));
  const step = (W - L - R) / Math.max(months.length, 1), bw = Math.min(30, step - 10);
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / hi;
  return (
    <div className="chart" ref={tip.ref} onPointerOver={tip.onOver} onPointerLeave={tip.onLeave}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Parcelas já comprometidas nos próximos meses">
        {[0, hi / 3, (2 * hi) / 3, hi].map((v) => (
          <g key={v}>
            <line className="gl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="ax" x={L - 8} y={y(v) + 3.5} textAnchor="end">{v ? BRLk(v) : "R$ 0"}</text>
          </g>
        ))}
        {months.map((m, k) => {
          const cx = L + step * k + step / 2;
          let acc = 0;
          return (
            <g key={m.label}>
              {m.items.map((it, j) => {
                const y0 = y(acc), y1 = y(acc + it.value) + (acc > 0 ? 1 : 0);
                acc += it.value;
                const isTop = j === m.items.length - 1;
                const fill = group(it.group_key).color;
                const t = `${it.description} · ${BRL(it.value)}`;
                return isTop ? (
                  <path key={it.key} d={`M${cx - bw / 2},${y0}V${y1 + 4}q0,-4 4,-4h${bw - 8}q4,0 4,4V${y0}Z`} fill={fill} data-t={t} />
                ) : (
                  <rect key={it.key} x={cx - bw / 2} y={y1} width={bw} height={Math.max(0, y0 - y1 - 2)} fill={fill} data-t={t} />
                );
              })}
              <text className="ax" x={cx} y={y(m.total) - 6} textAnchor="middle" style={{ fill: m.total ? "var(--fg-2)" : undefined }}>{m.total ? BRLk(m.total) : "livre"}</text>
              <text className="ax" x={cx} y={H - 4} textAnchor="middle">{m.label}</text>
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}

export function BillsChart({ bills, next }: { bills: { label: string; total: number; current: boolean }[]; next: { label: string; total: number } | null }) {
  const tip = useTip();
  const W = 520, H = 150, bw = 34;
  const all = [...bills.map((b) => b.total), next?.total ?? 0];
  const hi = niceMax(Math.max(...all, 100));
  const cols = bills.length + (next ? 1 : 0);
  const step = W / Math.max(cols, 1);
  const y = (v: number) => 8 + ((hi - v) * (H - 30)) / hi;
  return (
    <div className="chart" ref={tip.ref} onPointerOver={tip.onOver} onPointerLeave={tip.onLeave}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Faturas recentes e parcelas já comprometidas no próximo mês">
        {[0, hi / 2, hi].map((v) => <line key={v} className="gl" x1={0} x2={W} y1={y(v)} y2={y(v)} />)}
        {bills.map((b, i) => {
          const x = step * i + step / 2 - bw / 2;
          return (
            <g key={b.label + i}>
              <path d={`M${x},${y(0)}V${y(b.total) + 3}q0,-3 3,-3h${bw - 6}q3,0 3,3V${y(0)}Z`} fill={b.current ? "var(--mint)" : "var(--raise-2)"} data-t={`Fatura ${b.label} · ${BRL(b.total)}`} />
              <text className="ax" x={x + bw / 2} y={H - 6} textAnchor="middle">{b.label}</text>
            </g>
          );
        })}
        {next && (() => {
          const x = step * bills.length + step / 2 - bw / 2;
          return (
            <g>
              <path d={`M${x},${y(0)}V${y(next.total) + 3}q0,-3 3,-3h${bw - 6}q3,0 3,3V${y(0)}Z`} fill="transparent" stroke="var(--fg-3)" strokeDasharray="3 3" data-t={`${next.label}: já comprometido em parcelas · ${BRL(next.total)}`} />
              <text className="ax" x={x + bw / 2} y={H - 6} textAnchor="middle">{next.label}</text>
            </g>
          );
        })()}
      </svg>
      {tip.node}
    </div>
  );
}

/** Money that becomes available each year, from fixed-income maturities. */
export function MaturityChart({ years, noDue }: { years: { year: string; total: number }[]; noDue: number }) {
  const tip = useTip();
  const cols = [...years.map((y) => ({ label: y.year, total: y.total, free: false })), ...(noDue > 0 ? [{ label: "sem prazo", total: noDue, free: true }] : [])];
  const W = 560, H = 180, L = 46, R = 6, T = 18, B = 22;
  const hi = niceMax(Math.max(...cols.map((c) => c.total), 100));
  const step = (W - L - R) / Math.max(cols.length, 1), bw = Math.min(40, step - 12);
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / hi;
  return (
    <div className="chart" ref={tip.ref} onPointerOver={tip.onOver} onPointerLeave={tip.onLeave}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Quanto vence em cada ano">
        {[0, hi / 2, hi].map((v) => (
          <g key={v}>
            <line className="gl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="ax" x={L - 8} y={y(v) + 3.5} textAnchor="end">{v ? BRLk(v) : "R$ 0"}</text>
          </g>
        ))}
        {cols.map((c, k) => {
          const x = L + step * k + step / 2 - bw / 2;
          return (
            <g key={c.label}>
              <path
                d={`M${x},${y(0)}V${y(c.total) + 4}q0,-4 4,-4h${bw - 8}q4,0 4,4V${y(0)}Z`}
                fill={c.free ? "transparent" : "var(--mint)"}
                stroke={c.free ? "var(--fg-3)" : undefined}
                strokeDasharray={c.free ? "3 3" : undefined}
                data-t={c.free ? `Sem vencimento (ações, liquidez diária) · ${BRL(c.total)}` : `Vence em ${c.label} · ${BRL(c.total)}`}
              />
              <text className="ax" x={x + bw / 2} y={y(c.total) - 6} textAnchor="middle" style={{ fill: "var(--fg-2)" }}>{BRLk(c.total)}</text>
              <text className="ax" x={x + bw / 2} y={H - 4} textAnchor="middle">{c.label}</text>
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}

/** Invested total over time, from the daily snapshots taken at each sync. */
export function HistoryChart({ points }: { points: { day: string; total: number }[] }) {
  const tip = useTip();
  const W = 440, H = 170, L = 48, R = 8, T = 10, B = 22;
  const vals = points.map((p) => p.total);
  const lo = Math.min(...vals), hiV = Math.max(...vals);
  const pad = Math.max((hiV - lo) * 0.15, hiV * 0.01, 1);
  const min = Math.max(0, lo - pad), max = hiV + pad;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(points.length - 1, 1);
  const y = (v: number) => T + ((max - v) * (H - T - B)) / (max - min);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join("L");
  return (
    <div className="chart" ref={tip.ref} onPointerOver={tip.onOver} onPointerLeave={tip.onLeave}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução do total investido">
        {[min, (min + max) / 2, max].map((v) => (
          <g key={v}>
            <line className="gl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="ax" x={L - 8} y={y(v) + 3.5} textAnchor="end">{BRLk(v)}</text>
          </g>
        ))}
        <path d={`M${line}L${x(points.length - 1)},${H - B}L${L},${H - B}Z`} fill="var(--mint-dim)" />
        <path d={`M${line}`} fill="none" stroke="var(--mint)" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={p.day} cx={x(i)} cy={y(p.total)} r={i === points.length - 1 ? 4.5 : 8} fill={i === points.length - 1 ? "var(--mint)" : "transparent"} data-t={`${p.day.slice(8, 10)}/${p.day.slice(5, 7)} · ${BRL(p.total)}`} />
        ))}
        <text className="ax" x={L} y={H - 4}>{`${points[0].day.slice(8, 10)}/${points[0].day.slice(5, 7)}`}</text>
        <text className="ax" x={W - R} y={H - 4} textAnchor="end">{`${points[points.length - 1].day.slice(8, 10)}/${points[points.length - 1].day.slice(5, 7)}`}</text>
      </svg>
      {tip.node}
    </div>
  );
}
