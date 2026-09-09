import { prisma } from "./prisma.js";
import { ApiError } from "./http.js";

export async function assertNoDuplicateTitle(
  userId: string,
  title: string,
  excludeId: string | null,
  force: boolean,
): Promise<void> {
  if (force) return;

  const conflict = await prisma.task.findFirst({
    where: {
      userId,
      title: { equals: title, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, title: true },
  });

  if (conflict) {
    throw new ApiError(
      409,
      "DUPLICATE_TITLE",
      "同じ名前のタスクがすでにあります。名前を変更してください。",
      { conflictingTaskId: conflict.id },
    );
  }
}
