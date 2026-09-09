import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/prisma.js";
import { recordHistory } from "./_lib/history.js";
import { sendError, methodNotAllowed, readJsonBody, ApiError } from "./_lib/http.js";
import { requireUser } from "./_lib/auth.js";

async function getOrCreateSettings(userId: string) {
  return prisma.appSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method === "GET") {
      const settings = await getOrCreateSettings(user.id);
      res.status(200).json(settings);
      return;
    }

    if (req.method === "PATCH") {
      const body = readJsonBody<{ taskFeatureEnabled?: unknown }>(req);
      if (typeof body.taskFeatureEnabled !== "boolean") {
        throw new ApiError(400, "INVALID_BODY", "taskFeatureEnabled は真偽値で指定してください");
      }
      const current = await getOrCreateSettings(user.id);
      const [settings] = await prisma.$transaction([
        prisma.appSettings.update({
          where: { userId: user.id },
          data: { taskFeatureEnabled: body.taskFeatureEnabled },
        }),
        recordHistory(prisma, user.id, "SETTINGS_UPDATED", "Settings", current.id, {
          taskFeatureEnabled: body.taskFeatureEnabled,
        }),
      ]);
      res.status(200).json(settings);
      return;
    }

    methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (err) {
    sendError(res, err);
  }
}
