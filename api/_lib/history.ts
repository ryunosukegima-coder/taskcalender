import type { Prisma, PrismaClient } from "@prisma/client";

export type HistoryAction =
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "TASK_SCHEDULED"
  | "TASK_RESCHEDULED"
  | "TASK_UNSCHEDULED"
  | "SETTINGS_UPDATED";

export function recordHistory(
  tx: PrismaClient | Prisma.TransactionClient,
  userId: string,
  action: HistoryAction,
  entityType: "Task" | "Settings",
  entityId: string | null,
  payload: Record<string, unknown>,
) {
  return tx.operationHistory.create({
    data: { userId, action, entityType, entityId, payload: payload as Prisma.InputJsonValue },
  });
}
