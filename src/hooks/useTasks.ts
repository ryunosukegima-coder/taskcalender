import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as api from "../api/client";
import type { Task } from "../api/client";
import { buildRecurrenceRule } from "../lib/validation";

export const TASKS_KEY = ["tasks"] as const;

export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: () => api.getTasks() });
}

export function useUnscheduledTasks() {
  const { data, ...rest } = useTasks();
  return { ...rest, data: data?.filter((t) => t.startDate == null) };
}

// Distinct category names already in use, for suggesting existing categories
// when adding/editing a task instead of requiring the name be retyped.
export function useCategoryOptions(): string[] {
  const { data } = useTasks();
  return useMemo(() => {
    const set = new Set<string>();
    for (const task of data ?? []) {
      if (task.category) set.add(task.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"));
  }, [data]);
}

// All mutations below update the cached task list immediately (optimistic),
// then reconcile with the server's response — local dev's per-request cold
// starts (see api/_lib/prisma.ts) can otherwise make every click/drag feel
// like it did nothing for several seconds. A failed request rolls the cache
// back to its pre-mutation snapshot.

async function snapshotAndCancel(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: TASKS_KEY });
  return queryClient.getQueryData<Task[]>(TASKS_KEY);
}

function rollback(queryClient: QueryClient, previous: Task[] | undefined) {
  if (previous) queryClient.setQueryData(TASKS_KEY, previous);
}

function patchTask(queryClient: QueryClient, id: string, patch: (task: Task) => Task) {
  queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map((t) => (t.id === id ? patch(t) : t)));
}

let optimisticIdCounter = 0;

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTask,
    onMutate: async (input) => {
      const previous = await snapshotAndCancel(queryClient);
      const now = new Date().toISOString();
      const placeholderId = `optimistic-${++optimisticIdCounter}`;
      const optimisticTask: Task = {
        id: placeholderId,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? null,
        estimatedHours: input.estimatedHours ?? null,
        urgency: input.urgency ?? null,
        importance: input.importance ?? null,
        completed: false,
        startDate: null,
        durationDays: null,
        isAllDay: true,
        startTime: null,
        endTime: null,
        recurrenceRule: null,
        createdAt: now,
        updatedAt: now,
      };
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => [optimisticTask, ...(old ?? [])]);
      return { previous, placeholderId };
    },
    onSuccess: (created, _input, context) => {
      patchTask(queryClient, context.placeholderId, () => created);
    },
    onError: (_err, _input, context) => rollback(queryClient, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof api.updateTask>[1]) =>
      api.updateTask(id, input),
    onMutate: async ({ id, ...input }) => {
      const previous = await snapshotAndCancel(queryClient);
      patchTask(queryClient, id, (t) => ({
        ...t,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
        ...(input.urgency !== undefined ? { urgency: input.urgency } : {}),
        ...(input.importance !== undefined ? { importance: input.importance } : {}),
        ...(input.completed !== undefined ? { completed: input.completed } : {}),
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => rollback(queryClient, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTask,
    onMutate: async (id) => {
      const previous = await snapshotAndCancel(queryClient);
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => rollback(queryClient, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

type ScheduleInput = Parameters<typeof api.scheduleTask>[1];

// Mirrors the "omitted key = leave unchanged" merge semantics of the
// PATCH /schedule endpoint (api/tasks/[id]/schedule.ts) so the optimistic
// result matches what the server will actually return.
function applyOptimisticSchedule(task: Task, input: ScheduleInput): Task {
  if (input.startDate == null) {
    return {
      ...task,
      startDate: null,
      durationDays: null,
      isAllDay: true,
      startTime: null,
      endTime: null,
      recurrenceRule: null,
    };
  }

  const next: Task = { ...task, startDate: input.startDate, durationDays: input.durationDays ?? task.durationDays };

  if (typeof input.isAllDay === "boolean") {
    if (input.isAllDay) {
      next.isAllDay = true;
      next.startTime = null;
      next.endTime = null;
    } else {
      next.isAllDay = false;
      next.startTime = input.startTime ?? next.startTime;
      next.endTime = input.endTime ?? next.endTime;
    }
  }

  if ("recurrence" in input) {
    try {
      next.recurrenceRule =
        input.recurrence == null ? null : buildRecurrenceRule(input.recurrence, new Date(input.startDate));
    } catch {
      // Left inconsistent only until onSettled's refetch corrects it — the
      // real validation already happened before this mutation was fired.
    }
  }

  return next;
}

export function useScheduleTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & ScheduleInput) => api.scheduleTask(id, input),
    onMutate: async ({ id, ...input }) => {
      const previous = await snapshotAndCancel(queryClient);
      patchTask(queryClient, id, (t) => applyOptimisticSchedule(t, input));
      return { previous };
    },
    onError: (_err, _vars, context) => rollback(queryClient, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
