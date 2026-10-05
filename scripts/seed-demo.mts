/**
 * Fills the local database with five months of realistic sample data, so the UI can be tried
 * without connecting a bank. Run with: LIU_TODAY=2026-09-28 npm run seed:demo
 * Refuses to run against a remote DATABASE_URL.
 */
import { categorize } from "../src/lib/categorize";
import { addMonths, daysInMonth, today, ymOf } from "../src/lib/dates";
import { getDb, insertMany } from "../src/lib/db";

if (process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)) {
  console.error("Recusei: DATABASE_URL aponta para um banco remoto. O seed de exemplo é só para o banco local.");
  process.exit(1);
}

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const money = (a: number, b: number) => Math.round((a + rnd() * (b - a)) * 100) / 100;

type Acc = { id: string; type: "BANK" | "CREDIT" };
const NU = { id: "demo-nu-conta", type: "BANK" } as Acc, ITAU = { id: "demo-itau-conta", type: "BANK" } as Acc, INTER = { id: "demo-inter-conta", type: "BANK" } as Acc;
const NUC = { id: "demo-nu-cartao", type: "CREDIT" } as Acc, ITAUC = { id: "demo-itau-cartao", type: "CREDIT" } as Acc;

const rows: unknown[][] = [];
let n = 0;
function tx(acc: Acc, date: string, description: string, amount: number, type: "DEBIT" | "CREDIT", pluggyCategory: string | null, inst?: { n: number; total: number; purchase: string }) {
  const direction = type === "CREDIT" ? "in" : "out";
  const c = categorize({ description, pluggyCategory, direction, accountType: acc.type });
  rows.push([`demo-${++n}`, acc.id, date, description, amount, direction, pluggyCategory, c.group, c.sub, c.excluded, inst?.n ?? null, inst?.total ?? null, inst?.purchase ?? null, null, "POSTED"]);
}

const now = process.env.LIU_TODAY ?? today();
const endYm = ymOf(now);
const months = [-4, -3, -2, -1, 0].map((k) => addMonths(endYm, k));
const lastDay = (ym: string) => (ym === endYm ? Number(now.slice(8, 10)) : daysInMonth(ym));
const d = (ym: string, day: number) => `${ym}-${String(day).padStart(2, "0")}`;

const PLANS = [
  { desc: "MAGALU IPHONE 15", acc: NUC, value: 383.25, total: 12, start: addMonths(endYm, -4), cat: "Electronics" },
  { desc: "LATAM AIRLINES", acc: NUC, value: 512, total: 6, start: addMonths(endYm, -1), cat: "Airport and airlines" },
  { desc: "TOK&STOK SOFA", acc: ITAUC, value: 289.9, total: 10, start: addMonths(endYm, -7), cat: "Houseware" },
  { desc: "PANAMERICANA CURSO FOTO", acc: ITAUC, value: 197, total: 4, start: addMonths(endYm, -3), cat: "Education" },
];

for (const ym of months) {
  const last = lastDay(ym);
  const has = (day: number) => day <= last;
  if (has(5)) tx(NU, d(ym, 5), "SALARIO EMPRESA XYZ LTDA", 11200, "CREDIT", "Salary");
  if (has(18) && ym !== addMonths(endYm, -2)) tx(NU, d(ym, 18), "PIX RECEBIDO FREELA DESIGN", 1200, "CREDIT", "Transfer - PIX");
  if (has(25)) tx(INTER, d(ym, 25), "RENDIMENTO CDB", money(90, 105), "CREDIT", "Interests");
  if (has(6)) {
    tx(NU, d(ym, 6), "PIX ENVIADO ALUGUEL APTO", 2200, "DEBIT", "Rent");
    tx(NU, d(ym, 6), "CONDOMINIO EDIFICIO SOL", 480, "DEBIT", "Housing");
  }
  if (has(10)) {
    tx(ITAU, d(ym, 10), "ENEL ENERGIA DEB AUT", money(150, 190), "DEBIT", "Electricity");
    tx(NU, d(ym, 10), "PAGAMENTO DE FATURA", money(1800, 2600), "DEBIT", "Credit card payment");
  }
  if (has(3)) tx(ITAU, d(ym, 3), "WIZARD IDIOMAS", 590, "DEBIT", "Education");
  if (has(12)) tx(ITAU, d(ym, 12), "PAGAMENTO FATURA CARTAO", money(900, 1300), "DEBIT", "Credit card payment");
  if (has(15)) tx(NU, d(ym, 15), "TED MESMA TITULARIDADE INTER", 1000, "DEBIT", "Same person transfer");

  for (let day = 1; day <= last; day++) {
    const date = d(ym, day);
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (rnd() < 0.55) tx(NUC, date, pick(["UBER *TRIP", "99APP *CORRIDA"]), money(14, 38), "DEBIT", "Taxi and ride-hailing");
    if (rnd() < 0.35 || wd === 5) tx(NUC, date, pick(["IFOOD *RESTAURANTE", "IFD*BURGER KING", "RAPPI*PEDIDO"]), money(38, wd === 5 ? 110 : 75), "DEBIT", "Food delivery");
    if (rnd() < 0.3) tx(NUC, date, "PADARIA REAL", money(12, 35), "DEBIT", "Bakery");
    if (wd === 6 || rnd() < 0.08) tx(ITAUC, date, pick(["PAO DE ACUCAR", "CARREFOUR HIPER", "HORTIFRUTI"]), money(90, 330), "DEBIT", "Groceries");
    if (rnd() < 0.12) tx(NUC, date, pick(["OUTBACK STEAKHOUSE", "BAR DO ZE", "STARBUCKS"]), money(40, 160), "DEBIT", "Eating out");
    if (rnd() < 0.08) tx(ITAUC, date, "POSTO SHELL", money(150, 260), "DEBIT", "Gas stations");
    if (rnd() < 0.05) tx(NUC, date, "DROGASIL", money(25, 120), "DEBIT", "Pharmacy");
    if (rnd() < 0.05) tx(NUC, date, pick(["CINEMARK", "SYMPLA INGRESSO"]), money(45, 140), "DEBIT", "Entertainment");
    if (rnd() < 0.05) tx(NUC, date, pick(["AMAZON BR", "MERCADOLIVRE*LOJA", "SHOPEE"]), money(40, 260), "DEBIT", "Online shopping");
    if (rnd() < 0.03) tx(ITAUC, date, pick(["RENNER", "ZARA BRASIL"]), money(90, 320), "DEBIT", "Clothing");
    if (rnd() < 0.04) tx(NUC, date, "ESTAPAR ESTACIONAMENTO", money(15, 40), "DEBIT", "Parking");
  }
  if (has(2)) tx(NUC, d(ym, 2), "SMART FIT", 129.9, "DEBIT", "Gyms and fitness centers");
  if (has(26)) tx(ITAUC, d(ym, 26), "NETFLIX.COM", 44.9, "DEBIT", "Video streaming");
  if (has(27)) tx(NUC, d(ym, 27), "SPOTIFY", 21.9, "DEBIT", "Music streaming");
  if (has(9)) tx(NUC, d(ym, 9), "APPLE.COM/BILL ICLOUD", 14.9, "DEBIT", "Digital services");
  if (has(14)) tx(NUC, d(ym, 14), "IOF COMPRA INTERNACIONAL", money(2, 9), "DEBIT", "Taxes");

  for (const p of PLANS) {
    const k = (Number(ym.slice(0, 4)) - Number(p.start.slice(0, 4))) * 12 + (Number(ym.slice(5, 7)) - Number(p.start.slice(5, 7)));
    if (k < 0 || k >= p.total || !has(8)) continue;
    tx(p.acc, d(ym, 8), `${p.desc} PARC ${String(k + 1).padStart(2, "0")}/${String(p.total).padStart(2, "0")}`, p.value, "DEBIT", p.cat, { n: k + 1, total: p.total, purchase: d(p.start, 8) });
  }
}

const db = await getDb();
for (const t of ["transactions", "accounts", "items", "bills", "investments", "goals", "settings", "category_rules", "budgets", "chat_messages"]) await db.query(`DELETE FROM ${t}`);

await insertMany(db, "items", ["id", "connector_name", "connector_color", "status", "last_synced_at"], [
  ["demo-item-nu", "Nubank", "#820ad1", "UPDATED", new Date().toISOString()],
  ["demo-item-itau", "Itaú", "#ec7000", "UPDATED", new Date().toISOString()],
  ["demo-item-inter", "Inter", "#ff7a00", "UPDATED", new Date().toISOString()],
], "");

const next = addMonths(endYm, 1);
await insertMany(db, "accounts", ["id", "item_id", "type", "subtype", "name", "number", "institution", "color", "balance", "credit_limit", "available_limit", "close_date", "due_date"], [
  [NU.id, "demo-item-nu", "BANK", "CHECKING_ACCOUNT", "Conta", "0001-1", "Nubank", "#820ad1", 8742.19, null, null, null, null],
  [ITAU.id, "demo-item-itau", "BANK", "CHECKING_ACCOUNT", "Conta corrente", "3344-5", "Itaú", "#ec7000", 3120.55, null, null, null, null],
  [INTER.id, "demo-item-inter", "BANK", "CHECKING_ACCOUNT", "Conta", "9876-0", "Inter", "#ff7a00", 1455.78, null, null, null, null],
  [NUC.id, "demo-item-nu", "CREDIT", "CREDIT_CARD", "Nubank Mastercard", "5162********8612", "Nubank", "#820ad1", 2184.33, 9000, 6815.67, `${next}-03`, `${next}-10`],
  [ITAUC.id, "demo-item-itau", "CREDIT", "CREDIT_CARD", "Itaú Visa", "4111********4471", "Itaú", "#ec7000", 1036.9, 6000, 4963.1, `${next}-05`, `${next}-12`],
], "");

await insertMany(db, "transactions", ["id", "account_id", "date", "description", "amount", "direction", "pluggy_category", "group_key", "sub_label", "excluded", "installment_number", "total_installments", "purchase_date", "total_amount", "status"], rows, "");

const bills: unknown[][] = [];
months.forEach((ym, i) => {
  bills.push([`demo-bill-nu-${ym}`, NUC.id, `${ym}-10`, `${ym}-03`, [1840.2, 2310.7, 1975.4, 2650.1, 2412.9][i]]);
  bills.push([`demo-bill-itau-${ym}`, ITAUC.id, `${ym}-12`, `${ym}-05`, [980.5, 1120.3, 890.75, 1310.4, 1205.6][i]]);
});
await insertMany(db, "bills", ["id", "account_id", "due_date", "close_date", "total_amount"], bills, "");
await insertMany(db, "investments", ["id", "item_id", "name", "type", "balance"], [["demo-cdb", "demo-item-inter", "CDB Inter 110% CDI", "FIXED_INCOME", 11000]], "");
await insertMany(db, "goals", ["name", "target", "saved", "deadline"], [
  ["Reserva de emergência", 30000, 18400, null],
  ["Viagem ao Japão", 25000, 6200, "2027-12-01"],
  ["Notebook novo", 8000, 2900, "2027-03-01"],
], "");
await db.query("INSERT INTO settings (key, value) VALUES ('savings_goal', '3000')");

console.log(`Exemplo criado: ${rows.length} transações em ${months.length} meses (até ${now}).`);
process.exit(0);
