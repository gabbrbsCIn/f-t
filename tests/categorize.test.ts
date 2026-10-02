import { describe, expect, it } from "vitest";
import { baseDescription, categorize } from "@/lib/categorize";

const out = (description: string, pluggyCategory: string | null = null, accountType: "BANK" | "CREDIT" = "CREDIT") =>
  categorize({ description, pluggyCategory, direction: "out", accountType });

describe("categorize", () => {
  it("maps common Brazilian merchants", () => {
    expect(out("IFOOD *RESTAURANTE")).toMatchObject({ group: "alim", sub: "Delivery" });
    expect(out("UBER *TRIP")).toMatchObject({ group: "transp", sub: "Apps de transporte" });
    expect(out("PAO DE ACUCAR")).toMatchObject({ group: "alim", sub: "Supermercado" });
    expect(out("NETFLIX.COM")).toMatchObject({ group: "lazer", sub: "Streaming e música" });
    expect(out("DROGASIL")).toMatchObject({ group: "saude", sub: "Farmácia" });
    expect(out("AMAZON BR")).toMatchObject({ group: "compras", sub: "Compras online" });
  });

  it("uses Pluggy's category when the description says nothing", () => {
    expect(out("PIX ENVIADO FULANO", "Rent", "BANK")).toMatchObject({ group: "moradia", sub: "Aluguel" });
    expect(out("XPTO 123", "Gas stations")).toMatchObject({ group: "transp", sub: "Combustível" });
  });

  it("does not confuse Mercado Livre with the supermarket", () => {
    expect(out("MERCADOLIVRE*LOJA")).toMatchObject({ group: "compras" });
    expect(out("MERCADO LIVRE")).toMatchObject({ group: "compras" });
  });

  it("leaves card bill payments and transfers between own accounts out of spending", () => {
    expect(out("PAGAMENTO DE FATURA", null, "BANK")).toMatchObject({ excluded: true, group: "transfer" });
    expect(out("TED", "Same person transfer", "BANK")).toMatchObject({ excluded: true });
    expect(out("APLICACAO CDB", null, "BANK")).toMatchObject({ excluded: true });
  });

  it("treats money coming into a card as a refund, not income", () => {
    expect(categorize({ description: "ESTORNO AMAZON", direction: "in", accountType: "CREDIT" })).toMatchObject({ excluded: true });
    expect(categorize({ description: "SALARIO EMPRESA", pluggyCategory: "Salary", direction: "in", accountType: "BANK" })).toMatchObject({ group: "entrada", sub: "Salário", excluded: false });
  });

  it("applies your own rules first", () => {
    const rules = [{ pattern: "padaria real", group_key: "lazer", sub_label: "Café com amigos" }];
    expect(categorize({ description: "PADARIA REAL", direction: "out" }, rules)).toMatchObject({ group: "lazer", sub: "Café com amigos" });
  });

  it("falls back to Outros", () => {
    expect(out("ZZZ COMERCIO 0099")).toMatchObject({ group: "outros", sub: "Sem categoria" });
  });
});

describe("baseDescription", () => {
  it("removes installment markers", () => {
    expect(baseDescription("AMAZON PARC 05/12")).toBe("amazon");
    expect(baseDescription("Magalu Parcela 3 de 10")).toBe("magalu");
  });
});
