import { databaseUrl, getDb } from "./db";

/** What is configured (yes/no only, never values) and whether the database answers. */
export async function health() {
  const env = {
    APP_PASSWORD: !!process.env.APP_PASSWORD,
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    DATABASE_URL: !!databaseUrl(),
    PLUGGY_CLIENT_ID: !!process.env.PLUGGY_CLIENT_ID,
    PLUGGY_CLIENT_SECRET: !!process.env.PLUGGY_CLIENT_SECRET,
    WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,
    OLLAMA_API_KEY: !!process.env.OLLAMA_API_KEY,
  };
  let database: { ok: boolean; error?: string } = { ok: false };
  try {
    const db = await getDb();
    await db.query("SELECT 1");
    database = { ok: true };
  } catch (e) {
    const err = e as Error & { code?: string };
    // Strip anything that looks like a connection string or host before showing it.
    const msg = (err.message ?? String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[url]").replace(/[\w.-]+\.(neon\.tech|supabase\.co|vercel-storage\.com)/gi, "[host]");
    database = { ok: false, error: `${err.code ? `${err.code}: ` : ""}${msg}`.slice(0, 240) };
  }
  return { ok: database.ok && env.APP_PASSWORD, env, database };
}
