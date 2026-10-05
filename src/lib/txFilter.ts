import { addDays, addMonths, daysInMonth, monthEnd, monthStart, ymOf } from "./dates";

/**
 * Everything the Transações tab can filter by. It lives in the URL, so any screen can link
 * straight to a filtered list: `txHref({ from: "2026-09-12", to: "2026-09-12", kind: "out" })`.
 *
 * URL keys: m (YYYY-MM) or de/ate (YYYY-MM-DD), cat (repeatable: "alim" or "alim:Delivery"),
 * conta (repeatable account id), tipo (out|in|moved), q, min, max, parc=1, editadas=1, obs=1, ocultas=1.
 */
export type TxFilter = {
  from: string;
  to: string;
  cats: string[];
  accounts: string[];
  kind: "all" | "out" | "in" | "moved";
  q: string;
  min: number | null;
  max: number | null;
  installments: boolean;
  edited: boolean;
  noted: boolean;
  hidden: boolean;
};

type Params = Record<string, string | string[] | undefined>;

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const KINDS = ["all", "out", "in", "moved"] as const;
const MAX_DAYS = 3 * 366;

const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const one = (v: string | string[] | undefined) => all(v)[0];
const money = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function emptyFilter(today: string): TxFilter {
  const ym = ymOf(today);
  return { from: monthStart(ym), to: monthEnd(ym), cats: [], accounts: [], kind: "all", q: "", min: null, max: null, installments: false, edited: false, noted: false, hidden: false };
}

/** Reads the filter from search params; anything missing or malformed falls back to "this month, everything". */
export function parseFilter(p: Params, today: string): TxFilter {
  const f = emptyFilter(today);
  const m = one(p.m), de = one(p.de), ate = one(p.ate);
  if (de && DAY.test(de)) {
    f.from = de;
    f.to = ate && DAY.test(ate) && ate >= de ? ate : de;
    if (daysBetween(f.from, f.to) > MAX_DAYS) f.from = addDays(f.to, -MAX_DAYS);
  } else if (m && YM.test(m)) {
    f.from = monthStart(m);
    f.to = monthEnd(m);
  }
  f.cats = [...new Set(all(p.cat).filter(Boolean))];
  f.accounts = [...new Set(all(p.conta).filter(Boolean))];
  const kind = one(p.tipo);
  f.kind = (KINDS as readonly string[]).includes(kind ?? "") ? (kind as TxFilter["kind"]) : "all";
  f.q = (one(p.q) ?? "").slice(0, 120);
  f.min = money(one(p.min));
  f.max = money(one(p.max));
  f.installments = one(p.parc) === "1";
  f.edited = one(p.editadas) === "1";
  f.noted = one(p.obs) === "1";
  f.hidden = one(p.ocultas) === "1";
  return f;
}

/** Query string for a filter (without "?"); a whole calendar month is written as m=YYYY-MM. */
export function filterQuery(f: Partial<TxFilter> & { from: string; to: string }): string {
  const s = new URLSearchParams();
  if (isWholeMonth(f.from, f.to)) s.set("m", ymOf(f.from));
  else {
    s.set("de", f.from);
    if (f.to !== f.from) s.set("ate", f.to);
  }
  f.cats?.forEach((c) => s.append("cat", c));
  f.accounts?.forEach((a) => s.append("conta", a));
  if (f.kind && f.kind !== "all") s.set("tipo", f.kind);
  if (f.q?.trim()) s.set("q", f.q.trim());
  if (f.min != null) s.set("min", String(f.min));
  if (f.max != null) s.set("max", String(f.max));
  if (f.installments) s.set("parc", "1");
  if (f.edited) s.set("editadas", "1");
  if (f.noted) s.set("obs", "1");
  if (f.hidden) s.set("ocultas", "1");
  return s.toString();
}

/**
 * Link to the Transações tab. Pass a month (`ym`) or a day/range (`from`/`to`); the rest is optional.
 */
export function txHref(f: Partial<TxFilter> & ({ ym: string } | { from: string; to?: string })): string {
  const range = "ym" in f ? { from: monthStart(f.ym), to: monthEnd(f.ym) } : { from: f.from, to: f.to ?? f.from };
  return `/transacoes?${filterQuery({ ...f, ...range })}`;
}

export function isWholeMonth(from: string, to: string) {
  return from.slice(8) === "01" && ymOf(from) === ymOf(to) && Number(to.slice(8)) === daysInMonth(ymOf(to));
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** The period right before or after this one: month → month, day → day, otherwise a window of the same length. */
export function shiftPeriod(from: string, to: string, dir: 1 | -1): { from: string; to: string } {
  if (isWholeMonth(from, to)) {
    const ym = addMonths(ymOf(from), dir);
    return { from: monthStart(ym), to: monthEnd(ym) };
  }
  const len = daysBetween(from, to) + 1;
  return { from: addDays(from, dir * len), to: addDays(to, dir * len) };
}

export type FilterableTx = {
  date: string;
  description: string;
  original_description: string;
  amount: number;
  direction: "in" | "out";
  group_key: string;
  sub_label: string;
  excluded: boolean;
  hidden: boolean;
  note: string | null;
  edited: boolean;
  installment: string | null;
  account: { id: string };
};

/** A category token matches its whole group ("alim") or one subcategory ("alim:Delivery"). */
export function catMatches(token: string, t: Pick<FilterableTx, "group_key" | "sub_label">) {
  const i = token.indexOf(":");
  return i < 0 ? t.group_key === token : t.group_key === token.slice(0, i) && t.sub_label === token.slice(i + 1);
}

/** Every filter except the period, which the server already applied when loading. */
export function matches(t: FilterableTx, f: TxFilter, search: (t: FilterableTx) => boolean = () => true): boolean {
  if (t.hidden && !f.hidden) return false;
  const moved = t.excluded && !t.hidden;
  if (f.kind === "out" && (t.direction !== "out" || moved)) return false;
  if (f.kind === "in" && (t.direction !== "in" || moved)) return false;
  if (f.kind === "moved" && !moved) return false;
  if (f.cats.length && !f.cats.some((c) => catMatches(c, t))) return false;
  if (f.accounts.length && !f.accounts.includes(t.account.id)) return false;
  if (f.min != null && t.amount < f.min) return false;
  if (f.max != null && t.amount > f.max) return false;
  if (f.installments && !t.installment) return false;
  if (f.edited && !t.edited) return false;
  if (f.noted && !t.note) return false;
  return search(t);
}
