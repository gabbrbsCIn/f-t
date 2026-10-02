// Spending groups. Each one takes the color of a Brazilian banknote (see design/direcoes.html).
export type GroupKey = "moradia" | "alim" | "compras" | "saude" | "lazer" | "transp" | "outros";
export type TxGroup = GroupKey | "entrada" | "transfer";

export type Group = { key: GroupKey; name: string; note: string; color: string };

export const GROUPS: Group[] = [
  { key: "moradia", name: "Moradia", note: "100", color: "var(--c-moradia)" },
  { key: "alim", name: "Alimentação", note: "10", color: "var(--c-alim)" },
  { key: "compras", name: "Compras", note: "20", color: "var(--c-compras)" },
  { key: "saude", name: "Saúde e educação", note: "2", color: "var(--c-saude)" },
  { key: "lazer", name: "Lazer e assinaturas", note: "50", color: "var(--c-lazer)" },
  { key: "transp", name: "Transporte", note: "5", color: "var(--c-transp)" },
  { key: "outros", name: "Outros", note: "", color: "var(--c-outros)" },
];

export const GROUP_KEYS = GROUPS.map((g) => g.key) as GroupKey[];

export function group(key: string): Group {
  return GROUPS.find((g) => g.key === key) ?? GROUPS[GROUPS.length - 1];
}

export function isGroupKey(key: string): key is GroupKey {
  return (GROUP_KEYS as string[]).includes(key);
}
