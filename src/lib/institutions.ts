// Aggregator connectors (MeuPluggy) report their own name, so the real bank comes from the account name.
const BANKS: [RegExp, string, string][] = [
  [/nu ?pagamentos|nubank|\bnu\b/i, "Nubank", "#820ad1"],
  [/ita[uú]/i, "Itaú", "#ec7000"],
  [/\binter\b|banco inter/i, "Inter", "#ff7a00"],
  [/bradesco/i, "Bradesco", "#cc092f"],
  [/santander/i, "Santander", "#ec0000"],
  [/caixa/i, "Caixa", "#005ca9"],
  [/banco do brasil|\bbb\b/i, "Banco do Brasil", "#f8d117"],
  [/\bc6\b/i, "C6 Bank", "#242424"],
  [/btg/i, "BTG", "#0d2a4d"],
  [/\bxp\b/i, "XP", "#1c1c1c"],
  [/mercado ?pago/i, "Mercado Pago", "#00b1ea"],
  [/picpay/i, "PicPay", "#11c76f"],
  [/sicoob/i, "Sicoob", "#003641"],
  [/sicredi/i, "Sicredi", "#3fa110"],
];

export function knownBank(text: string | null | undefined): { name: string; color: string } | null {
  if (!text) return null;
  const hit = BANKS.find(([re]) => re.test(text));
  return hit ? { name: hit[1], color: hit[2] } : null;
}

/**
 * Institution for each account of an item. Cards rarely carry the bank's name, so a card takes the bank of
 * the item's checking account when there is exactly one.
 */
export function resolveInstitutions(
  accounts: { id: string; type: string; name: string; marketingName: string | null }[],
  connector: { name: string; primaryColor?: string | null },
) {
  const fromConnector = knownBank(connector.name);
  const fallback = { name: connector.name, color: connector.primaryColor ? `#${connector.primaryColor.replace(/^#/, "")}` : "#3a4a5c" };
  const banks = accounts.filter((a) => a.type === "BANK").map((a) => knownBank(`${a.marketingName ?? ""} ${a.name}`)).filter(Boolean);
  const onlyBank = new Set(banks.map((b) => b!.name)).size === 1 ? banks[0] : null;
  return new Map(
    accounts.map((a) => [a.id, knownBank(`${a.marketingName ?? ""} ${a.name}`) ?? fromConnector ?? (a.type === "CREDIT" ? onlyBank : null) ?? fallback]),
  );
}
