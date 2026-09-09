import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { config } from "dotenv";
import path from "node:path";

// `vercel dev`'s @vercel/node builder does not reliably forward .env.local
// into the function's dev sandbox (a local-tooling quirk only — Vercel's
// real production runtime injects configured env vars natively). Load it
// explicitly as a no-op fallback: config() never overwrites vars that are
// already set, and silently does nothing if the file isn't present.
if (!process.env.DATABASE_URL) {
  config({ path: path.resolve(process.cwd(), ".env.local") });
}

// The Neon serverless driver talks to Postgres over a pooled WebSocket
// instead of a raw TCP connection, which is markedly faster to establish
// per query — the dominant cost of every request under `vercel dev`, which
// spawns a fresh process (and so a fresh connection) per invocation.
neonConfig.webSocketConstructor = ws;

// Cache the client (and its pool) on globalThis so Vercel Function warm
// invocations (and local `vercel dev` hot reloads) reuse one connection
// instead of exhausting Neon's pooled connection limit on every cold start.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
