"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** A filter button that opens a panel under it; closes on outside click or Escape. */
export function FilterMenu({ label, count = 0, children, align = "left", wide }: { label: string; count?: number; children: (close: () => void) => React.ReactNode; align?: "left" | "right"; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="fm" ref={ref}>
      <button type="button" className={`fm-btn ${count ? "on" : ""}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}
        {count > 0 && <span className="fm-n">{count}</span>}
        <Icon name="chev" className="rot" size={13} />
      </button>
      {open && <div className={`fm-pop ${align} ${wide ? "wide" : ""}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
