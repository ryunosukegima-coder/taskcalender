import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../_lib/prisma.js";
import { recordHistory } from "../../_lib/history.js";
import { sendError, methodNotAllowed, readJsonBody, ApiError } from "../../_lib/http.js";
import { requireUser } from "../../_lib/auth.js";
import {
  buildRecurrenceRule,
  validateDurationDays,
  validateStartDate,
  validateTime,
  validateTimeRange,
  type RecurrenceInput,
} from "../../../shared/validation.js";

function getId(req: VercelRequest): string {
  const { id } = req.query;
  return Array.isArray(id) ? id[0] : (id ?? "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "PATCH") {
      methodNotAllowed(res, ["PATCH"]);
      return;
    }

    const user = await requireUser(req);
    const id = getId(req);
    const existing = await prisma.task.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "タスクが見つかりません");

    const body = readJsonBody<{
      startDate?: unknown;
      durationDays?: unknown;
      isAllDay?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      recurrence?: unknown;
    }>(req);

    // startDate: null (or omitted) -> unschedule
    if (body.startDate == null) {
      const task = await prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({
          where: { id },
          data: {
            startDate: null,
            durationDays: null,
            isAllDay: true,
            startTime: null,
            endTime: null,
            recurrenceRule: null,
          },
        });
        await recordHistory(tx, user.id, "TASK_UNSCHEDULED", "Task", id, {});
        return updated;
      });
      res.status(200).json(task);
      return;
    }

    if (typeof body.startDate !== "string") {
      throw new ApiError(400, "INVALID_BODY", "startDate は文字列で指定してください");
    }
    const startDate = validateStartDate(body.startDate);
    const durationDays = validateDurationDays(Number(body.durationDays));

    const data: {
      startDate: Date;
      durationDays: number;
      isAllDay?: boolean;
      startTime?: string | null;
      endTime?: string | null;
      recurrenceRule?: string | null;
    } = { startDate, durationDays };

    // isAllDay is only sent when the caller is deliberately changing it
    // (e.g. TaskDetailModal's schedule form, or dropping a timed event);
    // a plain all-day drag/resize omits it so time/recurrence are untouched.
    if (typeof body.isAllDay === "boolean") {
      if (body.isAllDay === false) {
        if (typeof body.startTime !== "string" || typeof body.endTime !== "string") {
          throw new ApiError(400, "INVALID_BODY", "startTime/endTime は文字列で指定してください");
        }
        const startTime = validateTime(body.startTime);
        const endTime = validateTime(body.endTime);
        validateTimeRange(startTime, endTime);
        data.isAllDay = false;
        data.startTime = startTime;
        data.endTime = endTime;
      } else {
        data.isAllDay = true;
        data.startTime = null;
        data.endTime = null;
      }
    }

    // recurrence key presence matters: absent = leave unchanged, null = clear.
    if ("recurrence" in body) {
      if (body.recurrence === null) {
        data.recurrenceRule = null;
      } else if (typeof body.recurrence === "object") {
        const rec = body.recurrence as { freq?: unknown; interval?: unknown; until?: unknown };
        if (typeof rec.freq !== "string") {
          throw new ApiError(400, "INVALID_BODY", "recurrence.freq は文字列で指定してください");
        }
        const recurrenceInput: RecurrenceInput = {
          freq: rec.freq as RecurrenceInput["freq"],
          interval: typeof rec.interval === "number" ? rec.interval : 1,
          until: typeof rec.until === "string" ? rec.until : null,
        };
        data.recurrenceRule = buildRecurrenceRule(recurrenceInput, startDate);
      } else {
        throw new ApiError(400, "INVALID_BODY", "recurrence の形式が正しくありません");
      }
    }

    const wasScheduled = existing.startDate != null;

    const task = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id }, data });
      await recordHistory(
        tx,
        user.id,
        wasScheduled ? "TASK_RESCHEDULED" : "TASK_SCHEDULED",
        "Task",
        id,
        { ...data, startDate: startDate.toISOString(), durationDays },
      );
      return updated;
    });

    res.status(200).json(task);
  } catch (err) {
    sendError(res, err);
  }
}
