"use client";
import { useRef, useState } from "react";

/** Tooltip for any chart: marks carry `data-t` (HTML-free text, lines split by \n). */
export function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const onOver = (e: React.PointerEvent) => {
    const el = (e.target as Element).closest("[data-t]") as Element | null;
    if (!el || !ref.current) return setTip(null);
    const r = ref.current.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setTip({ x: b.left - r.left + b.width / 2, y: b.top - r.top, text: el.getAttribute("data-t") ?? "" });
  };
  const node = tip && (
    <div className="tip" style={{ left: tip.x, top: tip.y }}>
      {tip.text.split("\n").map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
  return { ref, setTip, onOver, onLeave: () => setTip(null), node };
}
