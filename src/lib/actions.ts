import { categorize, baseDescription, type Rule } from "./categorize";
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

export async function addManualTransaction(p: { description: string; amount: number; date?: string; group_key?: string; sub_label?: string; direction?: "in" | "out" }) {
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
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,true,'chat')`,
    [id, CASH_ACCOUNT, date, p.description.slice(0, 120), Math.abs(p.amount), direction, groupKey, sub],
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
