import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./prisma.js";
import { ApiError } from "./http.js";

const SCRYPT_KEYLEN = 64;
const SESSION_COOKIE_NAME = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Vercel Serverless Functions always run behind HTTPS; only local `vercel
// dev` serves plain http, where a Secure cookie would silently never be set.
const SECURE_COOKIE = process.env.VERCEL === "1";

export interface SessionUser {
  id: string;
  email: string;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  const storedBuf = Buffer.from(hash, "hex");
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionToken(req: VercelRequest): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function destroySessionForRequest(req: VercelRequest): Promise<void> {
  const token = getSessionToken(req);
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function setSessionCookie(res: VercelResponse, token: string): void {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = SECURE_COOKIE ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`,
  );
}

export function clearSessionCookie(res: VercelResponse): void {
  const secure = SECURE_COOKIE ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=0`,
  );
}

export async function getSessionUser(req: VercelRequest): Promise<SessionUser | null> {
  const token = getSessionToken(req);
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return { id: session.user.id, email: session.user.email };
}

export async function requireUser(req: VercelRequest): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "ログインが必要です");
  return user;
}
