import { describe, expect, it } from "vitest";
import { classOf, rateLabel, shortName, summarize, type InvestmentRow } from "@/lib/investments";

const row = (p: Partial<InvestmentRow>): InvestmentRow => ({
  id: Math.random().toString(36), name: "X", type: "FIXED_INCOME", subtype: "CDB", balance: 100, gross: 102, invested: 90,
  rate: 100, rate_type: "CDI", fixed_rate: null, due_date: "2027-06-02", purchase_date: "2025-06-02", issuer: null, code: null, ...p,
});

describe("investments", () => {
  it("shortens product names", () => {
    expect(shortName(row({ name: "CDB - NU FINANCEIRA S.A. - SOCIEDADE DE CREDITO, FINANCIAMENTO E INVESTIMENTO" }))).toBe("CDB Nu Financeira");
    expect(shortName(row({ name: "Tesouro IPCA+ 2032" }))).toBe("Tesouro IPCA+ 2032");
    expect(shortName(row({ name: "ISHARES IBOVESPA", type: "EQUITY", code: "BOVA11" }))).toBe("BOVA11");
  });
  it("writes rates the way Brazilians read them", () => {
    expect(rateLabel(row({}))).toBe("100% do CDI");
    expect(rateLabel(row({ rate_type: "IPCA", rate: 100, fixed_rate: 7.62 }))).toBe("IPCA + 7,62%");
    expect(rateLabel(row({ rate_type: "SELIC", rate: 0.07 }))).toBe("Selic + 0,07%");
    expect(rateLabel(row({ type: "EQUITY", rate_type: null, rate: null }))).toBe("Renda variável");
  });
  it("classifies", () => {
    expect(classOf(row({ subtype: "TREASURY" })).key).toBe("tesouro");
    expect(classOf(row({ type: "EQUITY", subtype: "STOCK" })).key).toBe("acoes");
    expect(classOf(row({})).key).toBe("rf");
  });
  it("groups same product and rate, totals and maturities", () => {
    const s = summarize(
      [
        row({ name: "CDB - NU FINANCEIRA S.A. - X", balance: 100, invested: 90, due_date: "2027-06-02" }),
        row({ name: "CDB - NU FINANCEIRA S.A. - X", balance: 50, invested: 45, due_date: "2028-01-10" }),
        row({ name: "BOVA11", type: "EQUITY", subtype: "STOCK", code: "BOVA11", balance: 200, invested: null, gross: 200, rate: null, rate_type: null, due_date: null }),
      ],
      "2026-10-02",
    );
    expect(s.total).toBe(350);
    expect(s.groups).toHaveLength(2);
    expect(s.groups.find((g) => g.label === "CDB Nu Financeira")).toMatchObject({ balance: 150, invested: 135, nextDue: "2027-06-02" });
    expect(s.profitKnown).toBe(15);
    expect(s.maturities).toEqual([{ year: "2027", total: 100 }, { year: "2028", total: 50 }]);
    expect(s.noDue).toBe(200);
  });
});

describe("groupRate", () => {
  it("shows a range when buys of the same bond have different rates", async () => {
    const { groupRate } = await import("@/lib/investments");
    expect(groupRate([row({ rate_type: "SELIC", rate: 0.07 }), row({ rate_type: "SELIC", rate: 0.09 }), row({ rate_type: "SELIC", rate: 0.08 })])).toBe("Selic + 0,07% a 0,09%");
    expect(groupRate([row({}), row({})])).toBe("100% do CDI");
  });
});
