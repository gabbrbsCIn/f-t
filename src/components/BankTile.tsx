export function BankTile({ name, color, small }: { name: string; color: string | null; small?: boolean }) {
  return (
    <span className={`bank ${small ? "sm" : ""}`} style={{ background: color ?? "var(--raise-2)", color: color ? "#fff" : "var(--fg)" }}>
      {short(name, small)}
    </span>
  );
}

const KNOWN: Record<string, string> = { nubank: "nu", "itaú": "itaú", itau: "itaú", inter: "in", bradesco: "bra", santander: "san", "c6 bank": "c6", btg: "btg", xp: "xp", "mercado pago": "mp", picpay: "pic", caixa: "cx", "banco do brasil": "bb", dinheiro: "R$" };

function short(name: string, small?: boolean) {
  const n = name.toLowerCase().replace(/^banco\s+(?!do brasil)/, "").trim();
  const s = KNOWN[n] ?? n.slice(0, 3);
  return small ? s.slice(0, 2) : s;
}
