import { describe, expect, it } from "vitest";
import { byGroup, committedByMonth, cumulative, dailySpend, installmentPlans, recurringBills, spendToday, totals, type Tx } from "@/lib/finance";

let id = 0;
const t = (p: Partial<Tx>): Tx => ({
  id: String(++id),
  account_id: "a",
  date: "2026-09-01",
  description: "X",
  amount: 10,
  direction: "out",
  group_key: "outros",
  sub_label: "Sem categoria",
  excluded: false,
  installment_number: null,
  total_installments: null,
  purchase_date: null,
  source: "pluggy",
  account_type: "CREDIT",
  ...p,
});

describe("totals", () => {
  it("ignores excluded movements", () => {
    const txs = [t({ amount: 100 }), t({ amount: 50, excluded: true }), t({ amount: 1000, direction: "in", group_key: "entrada" }), t({ amount: 30, direction: "in", group_key: "transfer", excluded: true })];
    expect(totals(txs)).toEqual({ spent: 100, income: 1000 });
  });
});

describe("daily and cumulative", () => {
  it("adds spending per day", () => {
    const daily = dailySpend([t({ date: "2026-09-01", amount: 10 }), t({ date: "2026-09-01", amount: 5 }), t({ date: "2026-09-03", amount: 7 })], "2026-09");
    expect(daily.slice(0, 3)).toEqual([15, 0, 7]);
    expect(daily).toHaveLength(30);
    expect(cumulative([15, 0, 7])).toEqual([15, 15, 22]);
  });
});

describe("byGroup", () => {
  it("totals per group with subcategories and last month", () => {
    const g = byGroup([t({ group_key: "alim", sub_label: "Delivery", amount: 40 }), t({ group_key: "alim", sub_label: "Padaria", amount: 10 })], [t({ group_key: "alim", amount: 25 })]);
    const alim = g.find((x) => x.key === "alim")!;
    expect(alim).toMatchObject({ total: 50, prev: 25 });
    expect(alim.subs[0]).toEqual({ label: "Delivery", total: 40 });
    expect(g[0].key).toBe("alim");
  });
});

describe("installments", () => {
  const txs = [
    t({ description: "MAGALU PARC 04/12", amount: 383.25, date: "2026-08-08", installment_number: 4, total_installments: 12, purchase_date: "2026-05-08" }),
    t({ description: "MAGALU PARC 05/12", amount: 383.25, date: "2026-09-08", installment_number: 5, total_installments: 12, purchase_date: "2026-05-08" }),
    t({ description: "LATAM PARC 02/06", amount: 512, date: "2026-09-08", installment_number: 2, total_installments: 6, purchase_date: "2026-08-08" }),
  ];
  it("keeps the latest installment of each purchase", () => {
    const plans = installmentPlans(txs);
    expect(plans).toHaveLength(2);
    const magalu = plans.find((p) => p.description === "MAGALU")!;
    expect(magalu).toMatchObject({ current: 5, total: 12, remaining: 7, endYm: "2027-04" });
  });
  it("projects what is committed in the next months", () => {
    const c = committedByMonth(installmentPlans(txs), "2026-09", 8);
    expect(c[0]).toMatchObject({ ym: "2026-10", total: 895.25 });
    expect(c[4]).toMatchObject({ ym: "2027-02", total: 383.25 });
    expect(c[7]).toMatchObject({ ym: "2027-05", total: 0 });
  });
});

describe("spendToday", () => {
  it("splits what is left over the remaining days", () => {
    const r = spendToday({ income: 12400, expectedIncome: 0, spent: 8732.18, savingsGoal: 3000, day: 29, daysInMonth: 30 });
    expect(r).toMatchObject({ free: 667.82, daysLeft: 2, perDay: 333.91 });
  });
  it("uses expected income before the salary arrives", () => {
    expect(spendToday({ income: 0, expectedIncome: 10000, spent: 1000, savingsGoal: 2000, day: 2, daysInMonth: 30 }).free).toBe(7000);
  });
  it("never suggests a negative daily amount", () => {
    expect(spendToday({ income: 1000, expectedIncome: 0, spent: 2000, savingsGoal: 0, day: 10, daysInMonth: 30 }).perDay).toBe(0);
  });
});

describe("recurringBills", () => {
  it("finds a bill that repeats monthly and projects the next one", () => {
    const txs = [
      t({ description: "ENEL ENERGIA", amount: 170, date: "2026-08-10", account_type: "BANK" }),
      t({ description: "ENEL ENERGIA", amount: 165, date: "2026-09-10", account_type: "BANK" }),
      t({ description: "LOJA ALEATORIA", amount: 50, date: "2026-09-02", account_type: "BANK" }),
    ];
    expect(recurringBills(txs, "2026-09-28", 14)).toEqual([{ date: "2026-10-10", description: "ENEL ENERGIA", amount: 167.5, group_key: "outros" }]);
  });
});
