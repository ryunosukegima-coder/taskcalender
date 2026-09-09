import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/prisma.js";
import { sendError, methodNotAllowed } from "./_lib/http.js";
import { requireUser } from "./_lib/auth.js";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      methodNotAllowed(res, ["GET"]);
      return;
    }

    const user = await requireUser(req);

    const rawDays = req.query.days;
    const parsedDays = Number(Array.isArray(rawDays) ? rawDays[0] : rawDays);
    const days = Number.isFinite(parsedDays) && parsedDays > 0
      ? Math.min(parsedDays, MAX_DAYS)
      : DEFAULT_DAYS;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const entries = await prisma.operationHistory.findMany({
      where: { userId: user.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(entries);
  } catch (err) {
    sendError(res, err);
  }
}
