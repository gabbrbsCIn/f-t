import { PluggyClient } from "pluggy-sdk";

let client: PluggyClient | null = null;

export function pluggyConfigured(): boolean {
  return !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

export function pluggy(): PluggyClient {
  if (!pluggyConfigured()) throw new Error("Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.");
  client ??= new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID!,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
  });
  return client;
}

export function webhookUrl(): string | undefined {
  const base = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
  if (!base || !process.env.WEBHOOK_SECRET) return undefined;
  return `${base.replace(/\/$/, "")}/api/pluggy/webhook?secret=${encodeURIComponent(process.env.WEBHOOK_SECRET)}`;
}
