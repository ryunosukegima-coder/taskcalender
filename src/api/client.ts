import { ApiRequestError, FALLBACK_MESSAGE, type ApiErrorPayload } from "../lib/errors";
import type { RecurrenceInput } from "../lib/validation";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  estimatedHours: number | null;
  urgency: number | null;
  importance: number | null;
  completed: boolean;
  startDate: string | null;
  durationDays: number | null;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  recurrenceRule: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id: string;
  taskFeatureEnabled: boolean;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface HistoryEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

// `vercel dev` spawns a fresh child process per API request rather than
// reusing a warm one (unlike real production Vercel), so even a healthy
// local request routinely takes several seconds — 8s was tight enough to
// misreport those as failures. Real network/server failures still resolve
// well under this.
const REQUEST_TIMEOUT_MS = 20000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiRequestError(0, { code: "NETWORK_ERROR", message: FALLBACK_MESSAGE });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const payload: ApiErrorPayload = body?.error ?? {
      code: "UNKNOWN",
      message: FALLBACK_MESSAGE,
    };
    throw new ApiRequestError(response.status, payload);
  }

  return body as T;
}

export function getTasks(scheduled?: boolean): Promise<Task[]> {
  const query = scheduled === undefined ? "" : `?scheduled=${scheduled}`;
  return request<Task[]>(`/api/tasks${query}`);
}

export function createTask(input: {
  title: string;
  description?: string | null;
  category?: string | null;
  estimatedHours?: number | null;
  urgency?: number | null;
  importance?: number | null;
  force?: boolean;
}): Promise<Task> {
  return request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function updateTask(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    category?: string | null;
    estimatedHours?: number | null;
    urgency?: number | null;
    importance?: number | null;
    completed?: boolean;
    force?: boolean;
  },
): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteTask(id: string): Promise<void> {
  return request<void>(`/api/tasks/${id}`, { method: "DELETE" });
}

export function scheduleTask(
  id: string,
  input: {
    startDate: string | null;
    durationDays?: number;
    isAllDay?: boolean;
    startTime?: string;
    endTime?: string;
    recurrence?: RecurrenceInput | null;
  },
): Promise<Task> {
  return request<Task>(`/api/tasks/${id}/schedule`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getSettings(): Promise<AppSettings> {
  return request<AppSettings>("/api/settings");
}

export function updateSettings(input: { taskFeatureEnabled: boolean }): Promise<AppSettings> {
  return request<AppSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(input) });
}

export function getHistory(days = 7): Promise<HistoryEntry[]> {
  return request<HistoryEntry[]>(`/api/history?days=${days}`);
}

export function getMe(): Promise<AuthUser | null> {
  return request<AuthUser | null>("/api/auth/me");
}

export function signup(input: { email: string; password: string }): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/signup", { method: "POST", body: JSON.stringify(input) });
}

export function login(input: { email: string; password: string }): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function logout(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" });
}
