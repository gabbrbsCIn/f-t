"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const LINKS: [string, string, IconName][] = [
  ["/", "Visão geral", "home"],
  ["/transacoes", "Transações", "tx"],
  ["/parcelamentos", "Parcelamentos", "inst"],
  ["/categorias", "Categorias", "cats"],
  ["/cartoes", "Cartões", "cards"],
  ["/investimentos", "Investimentos", "invest"],
];

export function Nav() {
  const path = usePathname();
  const params = useSearchParams();
  const m = params.get("m");
  return (
    <nav className="nav" aria-label="Seções">
      {LINKS.map(([href, label, icon]) => (
        <Link key={href} href={m && href !== "/cartoes" && href !== "/investimentos" ? `${href}?m=${m}` : href} aria-current={path === href ? "page" : undefined}>
          <Icon name={icon} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
