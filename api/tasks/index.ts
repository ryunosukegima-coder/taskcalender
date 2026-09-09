import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../_lib/prisma.js";
import { recordHistory } from "../_lib/history.js";
import { sendError, methodNotAllowed, readJsonBody } from "../_lib/http.js";
import { assertNoDuplicateTitle } from "../_lib/tasks.js";
import { requireUser } from "../_lib/auth.js";
import {
  validateTitle,
  validateDescription,
  validateCategory,
  validateEstimatedHours,
  validateUrgency,
  validateImportance,
} from "../../shared/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method === "GET") {
      const scheduledParam = req.query.scheduled;
      const scheduled = Array.isArray(scheduledParam) ? scheduledParam[0] : scheduledParam;

      const where =
        scheduled === "true"
          ? { userId: user.id, startDate: { not: null } }
          : scheduled === "false"
            ? { userId: user.id, startDate: null }
            : { userId: user.id };

      const tasks = await prisma.task.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      res.status(200).json(tasks);
      return;
    }

    if (req.method === "POST") {
      const body = readJsonBody<{
        title?: unknown;
        description?: unknown;
        category?: unknown;
        estimatedHours?: unknown;
        urgency?: unknown;
        importance?: unknown;
        force?: unknown;
      }>(req);

      const title = validateTitle(typeof body.title === "string" ? body.title : "");
      const description = validateDescription(
        typeof body.description === "string" ? body.description : null,
      );
      const category = validateCategory(
        typeof body.category === "string" ? body.category : null,
      );
      const estimatedHours = validateEstimatedHours(
        typeof body.estimatedHours === "number" ? body.estimatedHours : null,
      );
      const urgency = validateUrgency(
        typeof body.urgency === "number" ? body.urgency : null,
      );
      const importance = validateImportance(
        typeof body.importance === "number" ? body.importance : null,
      );
      const force = body.force === true;

      await assertNoDuplicateTitle(user.id, title, null, force);

      const task = await prisma.$transaction(async (tx) => {
        const created = await tx.task.create({
          data: { userId: user.id, title, description, category, estimatedHours, urgency, importance },
        });
        await recordHistory(tx, user.id, "TASK_CREATED", "Task", created.id, {
          title,
          description,
          category,
          estimatedHours,
          urgency,
          importance,
        });
        return created;
      });

      res.status(201).json(task);
      return;
    }

    methodNotAllowed(res, ["GET", "POST"]);
  } catch (err) {
    sendError(res, err);
  }
}
