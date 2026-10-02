"use client";
import { askLiu, openConnect } from "./events";

export function AskButton({ q, children, className = "more" }: { q: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => askLiu(q)}>
      {children}
    </button>
  );
}

export function ConnectButton({ children, className = "more" }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => openConnect()}>
      {children}
    </button>
  );
}
