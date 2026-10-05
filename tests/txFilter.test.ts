import { describe, expect, it } from "vitest";
import { filterQuery, matches, parseFilter, shiftPeriod, txHref, type FilterableTx } from "../src/lib/txFilter";

const TODAY = "2026-09-28";
const tx = (p: Partial<FilterableTx> = {}): FilterableTx => ({
  date: "2026-09-12", description: "iFood", original_description: "iFood", amount: 42, direction: "out", group_key: "alim", sub_label: "Delivery",
  excluded: false, hidden: false, note: null, edited: false, installment: null, account: { id: "nu" }, ...p,
});

describe("parseFilter", () => {
  it("defaults to the current month", () => {
    const f = parseFilter({}, TODAY);
    expect([f.from, f.to, f.kind, f.cats]).toEqual(["2026-09-01", "2026-09-30", "all", []]);
  });
  it("reads a month, a single day and a range", () => {
    expect(parseFilter({ m: "2026-02" }, TODAY).to).toBe("2026-02-28");
    const day = parseFilter({ de: "2026-09-12" }, TODAY);
    expect([day.from, day.to]).toEqual(["2026-09-12", "2026-09-12"]);
    const bad = parseFilter({ de: "2026-09-12", ate: "2026-09-01" }, TODAY);
    expect(bad.to).toBe("2026-09-12");
  });
  it("reads repeated categories and accounts and ignores junk", () => {
    const f = parseFilter({ cat: ["alim", "lazer:Apostas"], conta: "nu", tipo: "nope", min: "10,5", parc: "1" }, TODAY);
    expect(f.cats).toEqual(["alim", "lazer:Apostas"]);
    expect(f.accounts).toEqual(["nu"]);
    expect(f.kind).toBe("all");
    expect(f.min).toBe(10.5);
    expect(f.installments).toBe(true);
  });
});

describe("links", () => {
  it("round-trips through the URL", () => {
    const href = txHref({ from: "2026-09-12", kind: "out", cats: ["alim:Delivery"], accounts: ["nu"] });
    expect(href).toBe("/transacoes?de=2026-09-12&cat=alim%3ADelivery&conta=nu&tipo=out");
    const f = parseFilter(Object.fromEntries(new URLSearchParams(href.split("?")[1])), TODAY);
    expect([f.from, f.to, f.cats[0], f.kind]).toEqual(["2026-09-12", "2026-09-12", "alim:Delivery", "out"]);
  });
  it("writes a whole month as m=", () => {
    expect(txHref({ ym: "2026-09", cats: ["alim"] })).toBe("/transacoes?m=2026-09&cat=alim");
    expect(filterQuery({ from: "2026-09-01", to: "2026-09-15" })).toBe("de=2026-09-01&ate=2026-09-15");
  });
  it("moves to the next or previous period", () => {
    expect(shiftPeriod("2026-09-01", "2026-09-30", -1)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(shiftPeriod("2026-09-12", "2026-09-12", 1)).toEqual({ from: "2026-09-13", to: "2026-09-13" });
    expect(shiftPeriod("2026-09-01", "2026-09-07", 1)).toEqual({ from: "2026-09-08", to: "2026-09-14" });
  });
});

describe("matches", () => {
  const f = parseFilter({}, TODAY);
  it("filters by group or subcategory", () => {
    expect(matches(tx(), { ...f, cats: ["alim"] })).toBe(true);
    expect(matches(tx(), { ...f, cats: ["alim:Mercado"] })).toBe(false);
    expect(matches(tx(), { ...f, cats: ["alim:Mercado", "alim:Delivery"] })).toBe(true);
  });
  it("filters by kind, account, value and flags", () => {
    expect(matches(tx({ excluded: true, group_key: "transfer" }), { ...f, kind: "out" })).toBe(false);
    expect(matches(tx({ excluded: true, group_key: "transfer" }), { ...f, kind: "moved" })).toBe(true);
    expect(matches(tx(), { ...f, accounts: ["itau"] })).toBe(false);
    expect(matches(tx(), { ...f, min: 50 })).toBe(false);
    expect(matches(tx(), { ...f, max: 50 })).toBe(true);
    expect(matches(tx(), { ...f, installments: true })).toBe(false);
    expect(matches(tx({ hidden: true, excluded: true }), f)).toBe(false);
    expect(matches(tx({ hidden: true, excluded: true }), { ...f, hidden: true })).toBe(true);
  });
});
