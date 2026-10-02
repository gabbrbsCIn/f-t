import { getDb } from "./db";
import { addMonths, daysInMonth, monthEnd, monthStart, today, ymOf, type Ym } from "./dates";
import { byGroup, cumulative, dailySpend, dominantGroupByDay, installmentPlans, committedByMonth, recurringBills, spendToday, sum, totals, weekdayAverages, type Tx } from "./finance";

export type AccountRow = {
  id: string;
  type: "BANK" | "CREDIT";
  subtype: string | null;
  name: string;
  number: string | null;
  institution: string | null;
  color: string | null;
  balance: number;
  credit_limit: number | null;
  available_limit: number | null;
  close_date: string | null;
  due_date: string | null;
};

const TX_COLS = `t.id, t.account_id, t.date, t.description, t.amount, t.direction, t.group_key, t.sub_label, t.excluded,
  t.installment_number, t.total_installments, t.purchase_date, t.source, a.type AS account_type`;

export async function txsBetween(from: string, to: string): Promise<Tx[]> {
  const db = await getDb();
  return db.query<Tx>(
    `SELECT ${TX_COLS} FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id
     WHERE t.date >= $1 AND t.date <= $2 ORDER BY t.date DESC, t.created_at DESC`,
    [from, to],
  );
}

export const txsOfMonth = (ym: Ym) => txsBetween(monthStart(ym), monthEnd(ym));

export async function accounts(): Promise<AccountRow[]> {
  const db = await getDb();
  return db.query<AccountRow>("SELECT * FROM accounts ORDER BY type, balance DESC");
}

export async function setting(key: string): Promise<string | null> {
  const db = await getDb();
  return (await db.query<{ value: string }>("SELECT value FROM settings WHERE key = $1", [key]))[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.query("INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, value]);
}

export async function hasData(): Promise<boolean> {
  const db = await getDb();
  return (await db.query("SELECT 1 FROM transactions LIMIT 1")).length > 0;
}

export async function lastSync(): Promise<string | null> {
  const db = await getDb();
  return (await db.query<{ v: string | null }>("SELECT max(last_synced_at) AS v FROM items"))[0]?.v ?? null;
}

/** Income you can count on this month: what already came in, or the average of the last 3 months if more. */
export async function expectedIncome(ym: Ym): Promise<number> {
  const prev = await txsBetween(monthStart(addMonths(ym, -3)), monthEnd(addMonths(ym, -1)));
  const months = [1, 2, 3].map((k) => totals(prev.filter((t) => ymOf(t.date) === addMonths(ym, -k))).income).filter((v) => v > 0);
  return months.length ? sum(months) / months.length : 0;
}

export async function overview(ym: Ym) {
  const now = today();
  const isCurrent = ymOf(now) === ym;
  const day = isCurrent ? Number(now.slice(8, 10)) : daysInMonth(ym);
  const prevYm = addMonths(ym, -1);

  const [txs, prevTxs, accs, goalRows, invest, savingsGoal, expIncome, history] = await Promise.all([
    txsOfMonth(ym),
    txsOfMonth(prevYm),
    accounts(),
    getDb().then((db) => db.query<{ id: number; name: string; target: number; saved: number; deadline: string | null }>("SELECT id, name, target, saved, deadline FROM goals ORDER BY created_at")),
    getDb().then((db) => db.query<{ total: number | null }>("SELECT sum(balance) AS total FROM investments")),
    setting("savings_goal"),
    expectedIncome(ym),
    txsBetween(monthStart(addMonths(ym, -3)), monthEnd(ym)),
  ]);

  const t = totals(txs);
  const daily = dailySpend(txs, ym);
  const prevDaily = dailySpend(prevTxs, prevYm);
  const cum = cumulative(daily).slice(0, day);
  const prevCum = cumulative(prevDaily);
  const samePoint = prevCum[Math.min(day, prevCum.length) - 1] ?? 0;
  const groups = byGroup(txs, prevTxs);
  const goal = Number(savingsGoal ?? 0);
  const spend = spendToday({ income: t.income, expectedIncome: expIncome, spent: t.spent, savingsGoal: goal, day, daysInMonth: daysInMonth(ym) });
  const wd = weekdayAverages(txs, ym, day);
  const topWd = wd.indexOf(Math.max(...wd));

  const bank = accs.filter((a) => a.type === "BANK");
  const cards = accs.filter((a) => a.type === "CREDIT");

  const upcoming = [
    ...cards.filter((c) => c.due_date && c.due_date >= now).map((c) => ({ date: c.due_date!, description: `Fatura ${c.institution ?? c.name}`, detail: c.close_date ? `fecha em ${c.close_date.slice(8, 10)}/${c.close_date.slice(5, 7)}` : "cartão", amount: Math.abs(c.balance), group_key: "outros" })),
    ...recurringBills(history, now, 14).map((r) => ({ ...r, detail: "todo mês" })),
  ]
    .filter((u) => u.date <= addDaysIso(now, 14))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Income events for the month line: deposits of R$ 500 or more.
  const incomeEvents = txs.filter((x) => x.direction === "in" && !x.excluded && x.group_key === "entrada" && x.amount >= 500).map((x) => ({ day: Number(x.date.slice(8, 10)), label: x.sub_label, amount: x.amount }));
  const billEvents = cards.filter((c) => c.due_date && ymOf(c.due_date) === ym).map((c) => ({ day: Number(c.due_date!.slice(8, 10)), label: `fatura ${c.institution ?? ""}`.trim() }));

  return {
    ym,
    day,
    isCurrent,
    spent: t.spent,
    income: t.income,
    prevSpentSamePoint: samePoint,
    groups,
    daily,
    dominant: dominantGroupByDay(txs, ym),
    cum,
    prevCum,
    spend,
    savingsGoal: goal,
    weekday: { index: topWd, avg: wd[topWd] ?? 0 },
    bank,
    cards,
    invested: invest[0]?.total ?? 0,
    goals: goalRows,
    upcoming,
    incomeEvents,
    billEvents,
    biggest: txs.filter((x) => x.direction === "out" && !x.excluded).sort((a, b) => b.amount - a.amount)[0] ?? null,
  };
}

function addDaysIso(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function installmentsView(ym: Ym) {
  const history = await txsBetween(monthStart(addMonths(ym, -24)), monthEnd(ym));
  const plans = installmentPlans(history).filter((p) => p.endYm >= ym);
  const thisMonth = sum(history.filter((t) => ymOf(t.date) === ym && t.direction === "out" && (t.total_installments ?? 0) > 1).map((t) => t.amount));
  return { plans, thisMonth, committed: committedByMonth(plans, ym, 8), stillToPay: sum(plans.map((p) => p.value * p.remaining)) };
}

export async function cardsView() {
  const db = await getDb();
  const cards = (await accounts()).filter((a) => a.type === "CREDIT");
  const bills = await db.query<{ account_id: string; due_date: string; total_amount: number }>("SELECT account_id, due_date, total_amount FROM bills ORDER BY due_date");
  const ym = ymOf(today());
  const history = await txsBetween(monthStart(addMonths(ym, -24)), monthEnd(ym));
  const plans = installmentPlans(history);
  return cards.map((c) => {
    const mine = plans.filter((p) => p.account_id === c.id);
    // The bill due next is already known; what follows it is what installments have committed.
    const next = committedByMonth(mine, c.due_date ? ymOf(c.due_date) : ym, 1)[0];
    return { card: c, bills: bills.filter((b) => b.account_id === c.id).slice(-6), nextCommitted: next };
  });
}
