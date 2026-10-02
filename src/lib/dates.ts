export const TZ = "America/Sao_Paulo";

/** Calendar date (YYYY-MM-DD) of an instant in São Paulo time. */
export function isoDay(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function today(): string {
  return process.env.LIU_TODAY ?? isoDay(new Date());
}

export type Ym = string; // YYYY-MM

export function ymOf(day: string): Ym {
  return day.slice(0, 7);
}

export function addMonths(ym: Ym, n: number): Ym {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(ym: Ym): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthStart(ym: Ym): string {
  return `${ym}-01`;
}

export function monthEnd(ym: Ym): string {
  return `${ym}-${String(daysInMonth(ym)).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday. */
export function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthName(ym: Ym): string {
  return MONTHS[Number(ym.slice(5, 7)) - 1];
}

export function monthShort(ym: Ym): string {
  return SHORT[Number(ym.slice(5, 7)) - 1];
}

export function monthLabel(ym: Ym): string {
  const name = monthName(ym);
  return `${name[0].toUpperCase()}${name.slice(1)} ${ym.slice(0, 4)}`;
}

/** "05 out" */
export function dayShort(day: string): string {
  return `${day.slice(8, 10)} ${SHORT[Number(day.slice(5, 7)) - 1]}`;
}

export function validYm(v: string | undefined | null): Ym | null {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
}
