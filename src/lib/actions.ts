import { CATALOG, categorize, baseDescription, type Rule } from "./categorize";
import { isGroupKey } from "./categories";
import { today } from "./dates";
import { getDb } from "./db";
import { setSetting } from "./queries";

export const CASH_ACCOUNT = "manual-cash";

/** Change a transaction's category. With `rule`, every past and future transaction with the same description follows. */
export async function recategorize(id: string, groupKey: string, subLabel: string, rule: boolean) {
  if (!isGroupKey(groupKey) && groupKey !== "transfer") throw new Error("Categoria desconhecida.");
  const sub = subLabel.trim().slice(0, 60) || "Sem categoria";
  const db = await getDb();
  const tx = (await db.query<{ description: string }>("SELECT description FROM transactions WHERE id = $1", [id]))[0];
  if (!tx) throw new Error("Transação não encontrada.");
  const excluded = groupKey === "transfer";
  await db.query("UPDATE transactions SET group_key = $2, sub_label = $3, excluded = $4, user_edited = true WHERE id = $1", [id, groupKey, sub, excluded]);
  let updated = 1;
  if (rule) {
    const pattern = baseDescription(tx.description);
    if (pattern.length >= 3) {
      await db.query(
        "INSERT INTO category_rules (pattern, group_key, sub_label) VALUES ($1,$2,$3) ON CONFLICT (pattern) DO UPDATE SET group_key = EXCLUDED.group_key, sub_label = EXCLUDED.sub_label",
        [pattern, groupKey, sub],
      );
      const others = await db.query<{ id: string; description: string }>("SELECT id, description FROM transactions WHERE id <> $1 AND direction = 'out'", [id]);
      const ids = others.filter((o) => baseDescription(o.description).includes(pattern)).map((o) => o.id);
      if (ids.length) {
        await db.query("UPDATE transactions SET group_key = $2, sub_label = $3, excluded = $4, user_edited = true WHERE id = ANY($1::text[])", [ids, groupKey, sub, excluded]);
        updated += ids.length;
      }
    }
  }
  return { ok: true, updated };
}

export async function addManualTransaction(p: { description: string; amount: number; date?: string; group_key?: string; sub_label?: string; direction?: "in" | "out"; source?: "chat" | "manual" }) {
  const db = await getDb();
  const rules = await db.query<Rule>("SELECT pattern, group_key, sub_label FROM category_rules");
  const direction = p.direction ?? "out";
  const auto = categorize({ description: p.description, direction, accountType: "MANUAL" }, rules);
  const groupKey = p.group_key && (isGroupKey(p.group_key) || p.group_key === "entrada") ? p.group_key : auto.group;
  const sub = p.sub_label?.trim() || auto.sub;
  const date = p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : today();
  const id = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await db.query(
    "INSERT INTO accounts (id, type, subtype, name, institution, balance) VALUES ($1,'MANUAL','CASH','Dinheiro','Dinheiro',0) ON CONFLICT (id) DO NOTHING",
    [CASH_ACCOUNT],
  );
  await db.query(
    `INSERT INTO transactions (id, account_id, date, description, amount, direction, group_key, sub_label, excluded, user_edited, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,true,$9)`,
    [id, CASH_ACCOUNT, date, p.description.slice(0, 120), Math.abs(p.amount), direction, groupKey, sub, p.source ?? "chat"],
  );
  return { id, date, group_key: groupKey, sub_label: sub, amount: Math.abs(p.amount), description: p.description };
}

export async function deleteManualTransaction(id: string) {
  const db = await getDb();
  const r = await db.query("DELETE FROM transactions WHERE id = $1 AND source = 'chat' RETURNING id", [id]);
  return { ok: r.length > 0 };
}

export async function createGoal(p: { name: string; target: number; saved?: number; deadline?: string | null }) {
  const db = await getDb();
  const row = (
    await db.query<{ id: number }>("INSERT INTO goals (name, target, saved, deadline) VALUES ($1,$2,$3,$4) RETURNING id", [
      p.name.slice(0, 80),
      p.target,
      p.saved ?? 0,
      p.deadline ?? null,
    ])
  )[0];
  return { id: row.id, ...p };
}

export async function updateGoal(id: number, p: { saved?: number; target?: number }) {
  const db = await getDb();
  await db.query("UPDATE goals SET saved = COALESCE($2, saved), target = COALESCE($3, target) WHERE id = $1", [id, p.saved ?? null, p.target ?? null]);
  return { ok: true };
}

export async function setBudget(groupKey: string, amount: number) {
  if (!isGroupKey(groupKey)) throw new Error("Categoria desconhecida.");
  const db = await getDb();
  await db.query("INSERT INTO budgets (group_key, amount) VALUES ($1,$2) ON CONFLICT (group_key) DO UPDATE SET amount = EXCLUDED.amount", [groupKey, amount]);
  return { ok: true };
}

export async function setSavingsGoal(amount: number) {
  await setSetting("savings_goal", String(amount));
  return { ok: true };
}

export type TxPatch = {
  description?: string | null;
  amount?: number | null;
  date?: string | null;
  hidden?: boolean;
  note?: string | null;
  group_key?: string;
  sub_label?: string;
  rule?: boolean;
};

/**
 * Edit a transaction. Description, amount and date are stored as overrides next to the bank's values,
 * so syncing again never undoes them; sending null restores the bank's value.
 */
export async function updateTransaction(id: string, p: TxPatch) {
  const db = await getDb();
  const [tx] = await db.query<{ id: string; description: string; amount: number; date: string }>("SELECT id, description, amount, date FROM transactions WHERE id = $1", [id]);
  if (!tx) throw new Error("Transação não encontrada.");
  const sets: string[] = [];
  const params: unknown[] = [id];
  const set = (col: string, v: unknown) => {
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  };
  if (p.description !== undefined) {
    const d = p.description?.trim().slice(0, 120) || null;
    set("description_override", d && d !== tx.description ? d : null);
  }
  if (p.amount !== undefined) {
    if (p.amount !== null && (!Number.isFinite(p.amount) || p.amount <= 0 || p.amount > 100_000_000)) throw new Error("Valor inválido.");
    const a = p.amount === null ? null : Math.round(p.amount * 100) / 100;
    set("amount_override", a !== null && a !== tx.amount ? a : null);
  }
  if (p.date !== undefined) {
    if (p.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) throw new Error("Data inválida.");
    set("date_override", p.date && p.date !== tx.date ? p.date : null);
  }
  if (p.hidden !== undefined) set("hidden", !!p.hidden);
  if (p.note !== undefined) set("note", p.note?.trim().slice(0, 500) || null);
  if (sets.length) await db.query(`UPDATE transactions SET ${sets.join(", ")} WHERE id = $1`, params);
  let updated = 1;
  if (p.group_key) updated = (await recategorize(id, p.group_key, p.sub_label ?? "", p.rule ?? false)).updated;
  return { ok: true, updated };
}

export async function deleteTransaction(id: string) {
  const db = await getDb();
  const r = await db.query("DELETE FROM transactions WHERE id = $1 AND source <> 'pluggy' RETURNING id", [id]);
  if (!r.length) throw new Error("Só dá para apagar transações criadas por você. As do banco podem ser ocultadas.");
  return { ok: true };
}

export type CategoryOption = { group_key: string; label: string; custom: boolean };

/** Every subcategory you can pick: yours first, then the app's catalog and anything already in use. */
export async function categoryOptions(): Promise<CategoryOption[]> {
  const db = await getDb();
  const [custom, used] = await Promise.all([
    db.query<{ group_key: string; label: string }>("SELECT group_key, label FROM custom_categories ORDER BY created_at"),
    db.query<{ group_key: string; label: string }>("SELECT DISTINCT group_key, sub_label AS label FROM transactions WHERE direction = 'out' AND group_key <> 'transfer'"),
  ]);
  const seen = new Set<string>();
  const out: CategoryOption[] = [];
  const add = (g: string, l: string, c: boolean) => {
    const k = `${g}|${l.toLowerCase()}`;
    if (!isGroupKey(g) || seen.has(k)) return;
    seen.add(k);
    out.push({ group_key: g, label: l, custom: c });
  };
  custom.forEach((c) => add(c.group_key, c.label, true));
  for (const [g, subs] of Object.entries(CATALOG)) subs.forEach((s) => add(g, s, false));
  used.forEach((u) => add(u.group_key, u.label, false));
  return out;
}

export async function createCategory(groupKey: string, label: string) {
  if (!isGroupKey(groupKey)) throw new Error("Escolha em qual grupo a categoria entra.");
  const l = label.trim().replace(/\s+/g, " ").slice(0, 40);
  if (l.length < 2) throw new Error("Nome muito curto.");
  const name = l[0].toUpperCase() + l.slice(1);
  const db = await getDb();
  await db.query("INSERT INTO custom_categories (group_key, label) VALUES ($1,$2) ON CONFLICT (group_key, label) DO NOTHING", [groupKey, name]);
  return { group_key: groupKey, label: name, custom: true };
}

export async function deleteCategory(groupKey: string, label: string) {
  const db = await getDb();
  await db.query("DELETE FROM custom_categories WHERE group_key = $1 AND label = $2", [groupKey, label]);
  return { ok: true };
}
