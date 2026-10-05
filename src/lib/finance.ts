import { GROUPS, type GroupKey } from "./categories";
import { baseDescription } from "./categorize";
import { addDays, addMonths, daysInMonth, weekday, ymOf, type Ym } from "./dates";

export type Tx = {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  group_key: string;
  sub_label: string;
  excluded: boolean;
  installment_number: number | null;
  total_installments: number | null;
  purchase_date: string | null;
  source: string;
  account_type?: string | null;
  hidden?: boolean;
  note?: string | null;
  original_description?: string;
  original_amount?: number;
  original_date?: string;
  edited?: boolean;
};

export const isSpend = (t: Tx) => t.direction === "out" && !t.excluded;
export const isIncome = (t: Tx) => t.direction === "in" && !t.excluded && t.group_key === "entrada";

export const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

export function totals(txs: Tx[]) {
  return {
    spent: sum(txs.filter(isSpend).map((t) => t.amount)),
    income: sum(txs.filter(isIncome).map((t) => t.amount)),
  };
}

/** Spending per day of the month (index 0 = day 1). */
export function dailySpend(txs: Tx[], ym: Ym): number[] {
  const out = Array(daysInMonth(ym)).fill(0);
  for (const t of txs) if (isSpend(t) && ymOf(t.date) === ym) out[Number(t.date.slice(8, 10)) - 1] += t.amount;
  return out.map((v) => Math.round(v * 100) / 100);
}

export function cumulative(xs: number[]): number[] {
  let acc = 0;
  return xs.map((v) => Math.round((acc += v) * 100) / 100);
}

/** The group with the most spending on each day, or null on days without spending. */
export function dominantGroupByDay(txs: Tx[], ym: Ym): (GroupKey | null)[] {
  const days: Record<string, number>[] = Array.from({ length: daysInMonth(ym) }, () => ({}));
  for (const t of txs) {
    if (!isSpend(t) || ymOf(t.date) !== ym) continue;
    const d = days[Number(t.date.slice(8, 10)) - 1];
    d[t.group_key] = (d[t.group_key] ?? 0) + t.amount;
  }
  return days.map((d) => {
    const top = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
    return top ? (top[0] as GroupKey) : null;
  });
}

export type GroupTotal = { key: GroupKey; total: number; prev: number; subs: { label: string; total: number }[] };

export function byGroup(txs: Tx[], prevTxs: Tx[] = []): GroupTotal[] {
  const res = GROUPS.map((g) => {
    const mine = txs.filter((t) => isSpend(t) && t.group_key === g.key);
    const subs = new Map<string, number>();
    for (const t of mine) subs.set(t.sub_label, (subs.get(t.sub_label) ?? 0) + t.amount);
    return {
      key: g.key,
      total: sum(mine.map((t) => t.amount)),
      prev: sum(prevTxs.filter((t) => isSpend(t) && t.group_key === g.key).map((t) => t.amount)),
      subs: [...subs.entries()].map(([label, total]) => ({ label, total: Math.round(total * 100) / 100 })).sort((a, b) => b.total - a.total),
    };
  });
  return res.sort((a, b) => b.total - a.total);
}

/** Average spend per weekday, leaving out housing and installments so fixed bills don't skew it. */
export function weekdayAverages(txs: Tx[], ym: Ym, upToDay: number): number[] {
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  const first = `${ym}-01`;
  for (let i = 0; i < upToDay; i++) counts[weekday(addDays(first, i))]++;
  for (const t of txs) {
    if (!isSpend(t) || ymOf(t.date) !== ym || t.group_key === "moradia" || (t.total_installments ?? 0) > 1) continue;
    if (Number(t.date.slice(8, 10)) > upToDay) continue;
    sums[weekday(t.date)] += t.amount;
  }
  return sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
}

export type InstallmentPlan = {
  key: string;
  description: string;
  account_id: string;
  group_key: string;
  value: number;
  current: number;
  total: number;
  remaining: number;
  lastDate: string;
  endYm: Ym;
};

/** Active installment purchases, from card transactions that carry "n of N" metadata. */
export function installmentPlans(txs: Tx[]): InstallmentPlan[] {
  const plans = new Map<string, InstallmentPlan>();
  for (const t of txs) {
    if (t.direction !== "out" || !t.total_installments || t.total_installments < 2 || !t.installment_number) continue;
    const key = [t.account_id, baseDescription(t.description), t.total_installments, t.purchase_date ?? "", Math.round(t.amount)].join("|");
    const p = plans.get(key);
    if (!p || t.installment_number > p.current) {
      const remaining = t.total_installments - t.installment_number;
      plans.set(key, {
        key,
        description: t.description.replace(/\s*(parc(ela)?\.?|parcelado)?\s*\d{1,2}\s*(\/|de)\s*\d{1,2}\s*$/i, "").trim(),
        account_id: t.account_id,
        group_key: t.group_key,
        value: t.amount,
        current: t.installment_number,
        total: t.total_installments,
        remaining,
        lastDate: t.date,
        endYm: addMonths(ymOf(t.date), remaining),
      });
    }
  }
  return [...plans.values()].sort((a, b) => b.value * b.remaining - a.value * a.remaining);
}

/** How much is already committed in each of the next `months` months (starting next month). */
export function committedByMonth(plans: InstallmentPlan[], fromYm: Ym, months: number) {
  return Array.from({ length: months }, (_, k) => {
    const ym = addMonths(fromYm, k + 1);
    const items = plans
      .map((p) => {
        const left = monthsBetween(ymOf(p.lastDate), ym);
        return left >= 1 && left <= p.remaining ? { key: p.key, description: p.description, group_key: p.group_key, value: p.value } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return { ym, total: sum(items.map((i) => i.value)), items };
  });
}

export function monthsBetween(a: Ym, b: Ym): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

/**
 * "Pode gastar hoje": what is left of this month's income after what you already spent and the
 * amount you want to save, split across the days that remain (today included).
 */
export function spendToday(p: { income: number; expectedIncome: number; spent: number; savingsGoal: number; day: number; daysInMonth: number }) {
  const income = Math.max(p.income, p.expectedIncome);
  const free = Math.round((income - p.spent - p.savingsGoal) * 100) / 100;
  const daysLeft = p.daysInMonth - p.day + 1;
  return { income, free, daysLeft, perDay: free > 0 ? Math.round((free / daysLeft) * 100) / 100 : 0 };
}

/** Bills that repeat every month (same description, similar amount), projected into the next `days` days. */
export function recurringBills(txs: Tx[], fromDay: string, days = 14) {
  const byDesc = new Map<string, Tx[]>();
  for (const t of txs) {
    if (!isSpend(t) || t.account_type === "CREDIT" || (t.total_installments ?? 0) > 1) continue;
    const k = baseDescription(t.description);
    if (!k) continue;
    byDesc.set(k, [...(byDesc.get(k) ?? []), t]);
  }
  const until = addDays(fromDay, days);
  const out: { date: string; description: string; amount: number; group_key: string }[] = [];
  for (const list of byDesc.values()) {
    const months = new Set(list.map((t) => ymOf(t.date)));
    if (months.size < 2) continue;
    const last = list.sort((a, b) => a.date.localeCompare(b.date))[list.length - 1];
    const amounts = list.slice(-3).map((t) => t.amount);
    const avg = sum(amounts) / amounts.length;
    if (amounts.some((a) => Math.abs(a - avg) > avg * 0.2)) continue;
    const nextYm = addMonths(ymOf(last.date), 1);
    const dayNum = Math.min(Number(last.date.slice(8, 10)), daysInMonth(nextYm));
    const next = `${nextYm}-${String(dayNum).padStart(2, "0")}`;
    if (next > fromDay && next <= until) out.push({ date: next, description: last.description, amount: Math.round(avg * 100) / 100, group_key: last.group_key });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
