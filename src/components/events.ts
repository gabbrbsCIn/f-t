"use client";
// Small window events so any button on a page can open the chat or the bank connection.
export const askLiu = (text?: string) => window.dispatchEvent(new CustomEvent("liu:ask", { detail: text ?? null }));
export const openConnect = () => window.dispatchEvent(new CustomEvent("liu:connect"));
