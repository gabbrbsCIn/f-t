// Dates are stored as ISO text (YYYY-MM-DD) and money as double precision, so pg and PGlite return the same shapes.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id text PRIMARY KEY,
  connector_name text,
  connector_color text,
  status text,
  last_synced_at text,
  consent_expires_at text,
  created_at text DEFAULT (now()::text)
);
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  item_id text,
  type text NOT NULL,
  subtype text,
  name text,
  number text,
  institution text,
  color text,
  balance double precision DEFAULT 0,
  credit_limit double precision,
  available_limit double precision,
  close_date text,
  due_date text,
  updated_at text
);
CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  date text NOT NULL,
  description text NOT NULL,
  amount double precision NOT NULL,
  direction text NOT NULL,
  pluggy_category text,
  group_key text NOT NULL,
  sub_label text NOT NULL,
  excluded boolean NOT NULL DEFAULT false,
  user_edited boolean NOT NULL DEFAULT false,
  installment_number int,
  total_installments int,
  purchase_date text,
  total_amount double precision,
  status text,
  source text NOT NULL DEFAULT 'pluggy',
  created_at text DEFAULT (now()::text)
);
CREATE INDEX IF NOT EXISTS transactions_date ON transactions (date);
CREATE TABLE IF NOT EXISTS bills (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  due_date text NOT NULL,
  close_date text,
  total_amount double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS investments (
  id text PRIMARY KEY,
  item_id text,
  name text,
  type text,
  balance double precision NOT NULL DEFAULT 0
);
ALTER TABLE items ADD COLUMN IF NOT EXISTS next_auto_sync_at text;
-- Your edits live next to what the bank sent, so a new sync never overwrites them.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description_override text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_override double precision;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS date_override text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note text;
CREATE TABLE IF NOT EXISTS custom_categories (
  id serial PRIMARY KEY,
  group_key text NOT NULL,
  label text NOT NULL,
  created_at text DEFAULT (now()::text),
  UNIQUE (group_key, label)
);
ALTER TABLE investments ADD COLUMN IF NOT EXISTS subtype text;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS gross double precision;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS invested double precision;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS rate double precision;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS rate_type text;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS fixed_rate double precision;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS due_date text;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS purchase_date text;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS issuer text;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS code text;
CREATE TABLE IF NOT EXISTS investment_snapshots (
  day text PRIMARY KEY,
  total double precision NOT NULL,
  invested double precision
);
CREATE TABLE IF NOT EXISTS category_rules (
  pattern text PRIMARY KEY,
  group_key text NOT NULL,
  sub_label text NOT NULL
);
CREATE TABLE IF NOT EXISTS budgets (
  group_key text PRIMARY KEY,
  amount double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id serial PRIMARY KEY,
  name text NOT NULL,
  target double precision NOT NULL,
  saved double precision NOT NULL DEFAULT 0,
  deadline text,
  created_at text DEFAULT (now()::text)
);
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  conversation text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  display text,
  created_at text DEFAULT (now()::text)
);
`;
