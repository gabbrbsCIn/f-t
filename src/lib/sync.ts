import type { Account, Transaction } from "pluggy-sdk";
import { categorize, type Rule } from "./categorize";
import { addDays, isoDay, today } from "./dates";
import { getDb, insertMany, type Db } from "./db";
import { resolveInstitutions } from "./institutions";
import { pluggy } from "./pluggy";

const FIRST_SYNC_DAYS = 365;
const OVERLAP_DAYS = 10;

export type SyncResult = { items: number; accounts: number; transactions: number; errors: string[] };

/** Items listed in PLUGGY_ITEM_IDS (comma-separated), e.g. connected from the Pluggy dashboard. */
export async function registerEnvItems(db: Db) {
  const ids = (process.env.PLUGGY_ITEM_IDS ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^[\w-]{8,64}$/.test(s));
  for (const id of ids) await db.query("INSERT INTO items (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [id]);
}

export async function syncAll(): Promise<SyncResult> {
  const db = await getDb();
  await registerEnvItems(db);
  const items = await db.query<{ id: string }>("SELECT id FROM items");
  const res: SyncResult = { items: 0, accounts: 0, transactions: 0, errors: [] };
  for (const { id } of items) {
    try {
      const r = await syncItem(id, db);
      res.items++;
      res.accounts += r.accounts;
      res.transactions += r.transactions;
    } catch (e) {
      res.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  return res;
}

export async function syncItem(itemId: string, dbIn?: Db) {
  const db = dbIn ?? (await getDb());
  const api = pluggy();
  const item = await api.fetchItem(itemId);
  const prev = (await db.query<{ last_synced_at: string | null }>("SELECT last_synced_at FROM items WHERE id = $1", [itemId]))[0];

  await db.query(
    `INSERT INTO items (id, connector_name, connector_color, status, consent_expires_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET connector_name = EXCLUDED.connector_name, connector_color = EXCLUDED.connector_color,
       status = EXCLUDED.status, consent_expires_at = EXCLUDED.consent_expires_at`,
    [itemId, item.connector.name, item.connector.primaryColor ? `#${item.connector.primaryColor.replace(/^#/, "")}` : null, item.status, item.consentExpiresAt ? isoDay(item.consentExpiresAt) : null],
  );

  const rules = await db.query<Rule>("SELECT pattern, group_key, sub_label FROM category_rules");
  const accounts = (await api.fetchAccounts(itemId)).results;
  const from = prev?.last_synced_at ? addDays(prev.last_synced_at.slice(0, 10), -OVERLAP_DAYS) : addDays(today(), -FIRST_SYNC_DAYS);
  let txCount = 0;

  const inst = resolveInstitutions(accounts, item.connector);
  for (const acc of accounts) {
    const bank = inst.get(acc.id)!;
    await upsertAccount(db, acc, bank.name, bank.color);
    const txs = await api.fetchAllTransactions(acc.id, { dateFrom: from });
    await upsertTransactions(db, acc, txs, rules);
    txCount += txs.length;

    if (acc.type === "CREDIT") {
      const bills = (await api.fetchCreditCardBills(acc.id)).results;
      await insertMany(
        db,
        "bills",
        ["id", "account_id", "due_date", "close_date", "total_amount"],
        bills.map((b) => [b.id, acc.id, isoDay(b.dueDate), b.billClosingDate ? isoDay(b.billClosingDate) : null, b.totalAmount]),
        "ON CONFLICT (id) DO UPDATE SET due_date = EXCLUDED.due_date, close_date = EXCLUDED.close_date, total_amount = EXCLUDED.total_amount",
      );
    }
  }

  try {
    const inv = (await api.fetchInvestments(itemId)).results;
    await db.query("DELETE FROM investments WHERE item_id = $1", [itemId]);
    await insertMany(
      db,
      "investments",
      ["id", "item_id", "name", "type", "subtype", "balance", "gross", "invested", "rate", "rate_type", "fixed_rate", "due_date", "purchase_date", "issuer", "code"],
      inv
        .filter((i) => i.status !== "TOTAL_WITHDRAWAL" && i.balance > 0)
        .map((i) => [
          i.id, itemId, i.name, i.type, i.subtype, i.balance, i.amount, i.amountOriginal, i.rate, i.rateType, i.fixedAnnualRate,
          i.dueDate ? isoDay(i.dueDate) : null, i.purchaseDate ? isoDay(i.purchaseDate) : null, i.issuer, i.code,
        ]),
      "ON CONFLICT (id) DO NOTHING",
    );
  } catch {
    // Not every connector shares investments.
  }

  await db.query("UPDATE items SET last_synced_at = $2 WHERE id = $1", [itemId, new Date().toISOString()]);
  await snapshotInvestments(db);
  return { accounts: accounts.length, transactions: txCount };
}

async function upsertAccount(db: Db, acc: Account, institution: string, color?: string | null) {
  const cd = acc.creditData;
  await db.query(
    `INSERT INTO accounts (id, item_id, type, subtype, name, number, institution, color, balance, credit_limit, available_limit, close_date, due_date, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, subtype = EXCLUDED.subtype, name = EXCLUDED.name, number = EXCLUDED.number,
       institution = EXCLUDED.institution, color = EXCLUDED.color, balance = EXCLUDED.balance, credit_limit = EXCLUDED.credit_limit,
       available_limit = EXCLUDED.available_limit, close_date = EXCLUDED.close_date, due_date = EXCLUDED.due_date, updated_at = EXCLUDED.updated_at`,
    [
      acc.id,
      acc.itemId,
      acc.type,
      acc.subtype,
      acc.marketingName ?? acc.name,
      acc.number,
      institution,
      color ? `#${color.replace(/^#/, "")}` : null,
      acc.balance,
      cd?.creditLimit ?? null,
      cd?.availableCreditLimit ?? null,
      cd?.balanceCloseDate ? isoDay(cd.balanceCloseDate) : null,
      cd?.balanceDueDate ? isoDay(cd.balanceDueDate) : null,
      new Date().toISOString(),
    ],
  );
}

export function mapTransaction(acc: Pick<Account, "id" | "type">, t: Transaction, rules: Rule[]) {
  const direction: "in" | "out" = t.type === "CREDIT" ? "in" : "out";
  const c = categorize(
    { description: t.description, pluggyCategory: t.category, merchantCategory: t.merchant?.category, direction, accountType: acc.type },
    rules,
  );
  const m = t.creditCardMetadata;
  return [
    t.id,
    acc.id,
    isoDay(t.date),
    t.description,
    Math.abs(t.amount),
    direction,
    t.category,
    c.group,
    c.sub,
    c.excluded,
    m?.installmentNumber ?? null,
    m?.totalInstallments ?? null,
    m?.purchaseDate ? isoDay(m.purchaseDate) : null,
    m?.totalAmount ?? null,
    t.status ?? null,
  ];
}

async function upsertTransactions(db: Db, acc: Account, txs: Transaction[], rules: Rule[]) {
  await insertMany(
    db,
    "transactions",
    ["id", "account_id", "date", "description", "amount", "direction", "pluggy_category", "group_key", "sub_label", "excluded", "installment_number", "total_installments", "purchase_date", "total_amount", "status"],
    txs.map((t) => mapTransaction(acc, t, rules)),
    // Keep the category you set by hand when Pluggy sends the transaction again.
    `ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, description = EXCLUDED.description, amount = EXCLUDED.amount,
       direction = EXCLUDED.direction, pluggy_category = EXCLUDED.pluggy_category, status = EXCLUDED.status,
       installment_number = EXCLUDED.installment_number, total_installments = EXCLUDED.total_installments,
       purchase_date = EXCLUDED.purchase_date, total_amount = EXCLUDED.total_amount,
       group_key = CASE WHEN transactions.user_edited THEN transactions.group_key ELSE EXCLUDED.group_key END,
       sub_label = CASE WHEN transactions.user_edited THEN transactions.sub_label ELSE EXCLUDED.sub_label END,
       excluded = CASE WHEN transactions.user_edited THEN transactions.excluded ELSE EXCLUDED.excluded END`,
  );
}

/** One point per day of the invested total, so the investments page can draw its history over time. */
export async function snapshotInvestments(db: Db) {
  const [row] = await db.query<{ total: number | null; invested: number | null }>("SELECT sum(balance) AS total, sum(invested) AS invested FROM investments");
  if (row?.total == null) return;
  await db.query(
    "INSERT INTO investment_snapshots (day, total, invested) VALUES ($1,$2,$3) ON CONFLICT (day) DO UPDATE SET total = EXCLUDED.total, invested = EXCLUDED.invested",
    [today(), Math.round(row.total * 100) / 100, row.invested == null ? null : Math.round(row.invested * 100) / 100],
  );
}
