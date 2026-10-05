const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function BRL(v: number): string {
  return brl.format(v).replace(/ /g, " ");
}

/** "R$ 1,2k" / "R$ 350" for chart axes. */
export function BRLk(v: number): string {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return `R$ ${Math.round(v)}`;
}

export function pct(v: number, digits = 1): string {
  return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`;
}
