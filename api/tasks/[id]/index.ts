import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../_lib/prisma.js";
import { recordHistory } from "../../_lib/history.js";
import { sendError, methodNotAllowed, readJsonBody, ApiError } from "../../_lib/http.js";
import { assertNoDuplicateTitle } from "../../_lib/tasks.js";
import { requireUser } from "../../_lib/auth.js";
import {
  validateTitle,
  validateDescription,
  validateCategory,
  validateEstimatedHours,
  validateUrgency,
  validateImportance,
} from "../../../shared/validation.js";

function getId(req: VercelRequest): string {
  const { id } = req.query;
  return Array.isArray(id) ? id[0] : (id ?? "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);
    const id = getId(req);

    if (req.method === "GET") {
      const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
      if (!task) throw new ApiError(404, "NOT_FOUND", "タスクが見つかりません");
      res.status(200).json(task);
      return;
    }

    if (req.method === "PATCH") {
      const body = readJsonBody<{
        title?: unknown;
        description?: unknown;
        category?: unknown;
        estimatedHours?: unknown;
        urgency?: unknown;
        importance?: unknown;
        completed?: unknown;
        force?: unknown;
      }>(req);

      const existing = await prisma.task.findFirst({ where: { id, userId: user.id } });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "タスクが見つかりません");

      const data: {
        title?: string;
        description?: string | null;
        category?: string | null;
        estimatedHours?: number | null;
        urgency?: number | null;
        importance?: number | null;
        completed?: boolean;
      } = {};

      if (typeof body.title === "string") {
        const title = validateTitle(body.title);
        if (title.toLowerCase() !== existing.title.toLowerCase()) {
          await assertNoDuplicateTitle(user.id, title, id, body.force === true);
        }
        data.title = title;
      }
      if (typeof body.description === "string" || body.description === null) {
        data.description = validateDescription(body.description as string | null);
      }
      if (typeof body.category === "string" || body.category === null) {
        data.category = validateCategory(body.category as string | null);
      }
      if (typeof body.estimatedHours === "number" || body.estimatedHours === null) {
        data.estimatedHours = validateEstimatedHours(body.estimatedHours as number | null);
      }
      if (typeof body.urgency === "number" || body.urgency === null) {
        data.urgency = validateUrgency(body.urgency as number | null);
      }
      if (typeof body.importance === "number" || body.importance === null) {
        data.importance = validateImportance(body.importance as number | null);
      }
      if (typeof body.completed === "boolean") {
        data.completed = body.completed;
      }

      const task = await prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({ where: { id }, data });
        await recordHistory(tx, user.id, "TASK_UPDATED", "Task", id, data);
        return updated;
      });

      res.status(200).json(task);
      return;
    }

    if (req.method === "DELETE") {
      const existing = await prisma.task.findFirst({ where: { id, userId: user.id } });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "タスクが見つかりません");

      await prisma.$transaction(async (tx) => {
        await tx.task.delete({ where: { id } });
        await recordHistory(tx, user.id, "TASK_DELETED", "Task", id, { title: existing.title });
      });

      res.status(204).end();
      return;
    }

    methodNotAllowed(res, ["GET", "PATCH", "DELETE"]);
  } catch (err) {
    sendError(res, err);
  }
}
