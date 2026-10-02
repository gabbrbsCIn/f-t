import { SCHEMA } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

const g = globalThis as unknown as { __liuDb?: Promise<Db> };

/** Connection string under any of the names the Postgres integrations (Neon, Supabase, Vercel) use. */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || undefined;
}

/** Postgres when a connection string is set (production); otherwise an embedded PGlite database in .data/. */
export function getDb(): Promise<Db> {
  if (!g.__liuDb) {
    // Don't cache a failed connection: the next request tries again.
    g.__liuDb = init().catch((e) => {
      g.__liuDb = undefined;
      throw e;
    });
  }
  return g.__liuDb;
}

async function init(): Promise<Db> {
  let db: Db;
  const url = databaseUrl();
  if (!url && process.env.VERCEL) {
    throw new Error("DATABASE_URL não configurada. Conecte um Postgres (aba Storage → Neon) e faça um Redeploy.");
  }
  if (url) {
    const { Pool } = await import("pg");
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new Pool({ connectionString: url, max: 3, ssl: local ? undefined : { rejectUnauthorized: false } });
    db = {
      query: async (sql, params = []) => (await pool.query(sql, params as unknown[])).rows,
      exec: async (sql) => {
        await pool.query(sql);
      },
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR ?? ".data/pglite";
    if (dir !== "memory") (await import("node:fs")).mkdirSync(dir, { recursive: true });
    const pg = dir === "memory" ? new PGlite() : new PGlite(dir);
    db = {
      query: async (sql, params = []) => (await pg.query(sql, params as unknown[])).rows as never,
      exec: async (sql) => {
        await pg.exec(sql);
      },
    };
  }
  await db.exec(SCHEMA);
  return db;
}

/** Insert many rows in chunks: `INSERT ... VALUES (...), (...) ON CONFLICT ...`. */
export async function insertMany(
  db: Db,
  table: string,
  columns: string[],
  rows: unknown[][],
  onConflict: string,
  chunk = 200,
) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params: unknown[] = [];
    const values = part
      .map((r) => `(${r.map((v) => (params.push(v), `$${params.length}`)).join(",")})`)
      .join(",");
    await db.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${values} ${onConflict}`, params);
  }
}
