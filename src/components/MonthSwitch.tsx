import Link from "next/link";
import { addMonths, monthLabel, today, ymOf, type Ym } from "@/lib/dates";

export function MonthSwitch({ ym, path }: { ym: Ym; path: string }) {
  const current = ymOf(today());
  const next = addMonths(ym, 1);
  return (
    <div className="month">
      <Link href={`${path}?m=${addMonths(ym, -1)}`} aria-label="Mês anterior" className="mbtn">‹</Link>
      <span>{monthLabel(ym)}</span>
      {next <= current ? <Link href={next === current ? path : `${path}?m=${next}`} aria-label="Próximo mês" className="mbtn">›</Link> : <span className="mbtn" style={{ opacity: 0.3, minWidth: 0 }} aria-hidden="true">›</span>}
    </div>
  );
}
