import { useRef, useState } from "react";
import type { Task } from "../../api/client";
import { useDeleteTask, useScheduleTask, useUpdateTask } from "../../hooks/useTasks";
import { useDuplicateTitleGuard } from "../../hooks/useDuplicateTitleGuard";
import { messageForError } from "../../lib/errors";
import {
  buildRecurrenceRule,
  MAX_DESCRIPTION_LENGTH,
  MAX_ESTIMATED_HOURS,
  MAX_TITLE_LENGTH,
  MIN_ESTIMATED_HOURS,
  parseRecurrenceRule,
  RECURRENCE_FREQS,
  validateTime,
  validateTimeRange,
  ValidationError,
  type RecurrenceFreq,
  type RecurrenceInput,
} from "../../lib/validation";
import CategorySelect from "./CategorySelect";
import DuplicateTitleDialog from "./DuplicateTitleDialog";
import RatingPicker from "./RatingPicker";

interface Props {
  task: Task;
  onClose: () => void;
}

const RECURRENCE_FREQ_LABELS: Record<RecurrenceFreq, string> = {
  DAILY: "毎日",
  WEEKLY: "毎週",
  MONTHLY: "毎月",
};

function messageForScheduleError(err: unknown): string {
  if (err instanceof ValidationError) return err.message;
  return messageForError(err);
}

export default function TaskDetailModal({ task, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [category, setCategory] = useState(task.category ?? "");
  const [estimatedHours, setEstimatedHours] = useState(
    task.estimatedHours != null ? String(task.estimatedHours) : "",
  );
  const [urgency, setUrgency] = useState(task.urgency);
  const [importance, setImportance] = useState(task.importance);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const initialRecurrence = parseRecurrenceRule(task.recurrenceRule);
  const [isAllDay, setIsAllDay] = useState(task.isAllDay);
  const [startTime, setStartTime] = useState(task.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(task.endTime ?? "10:00");
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFreq | "">(
    initialRecurrence?.freq ?? "",
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(initialRecurrence?.interval ?? 1);
  const [recurrenceUntil, setRecurrenceUntil] = useState(initialRecurrence?.until ?? "");

  const updateTask = useUpdateTask();
  const scheduleTask = useScheduleTask();
  const deleteTask = useDeleteTask();
  const guard = useDuplicateTitleGuard(
    (input: {
      id: string;
      title: string;
      description?: string | null;
      category?: string | null;
      estimatedHours?: number | null;
      urgency?: number | null;
      importance?: number | null;
      force?: boolean;
    }) => updateTask.mutateAsync(input),
  );

  const isScheduled = task.startDate != null;
  const saving = updateTask.isPending || scheduleTask.isPending;

  function buildRecurrenceInput(): RecurrenceInput | null {
    return recurrenceFreq === ""
      ? null
      : { freq: recurrenceFreq, interval: recurrenceInterval, until: recurrenceUntil || null };
  }

  // Applies the "予定の詳細" fields (time/recurrence) after the title/description
  // save has gone through, so the single Save button commits both at once.
  async function saveScheduleIfNeeded(recurrence: RecurrenceInput | null) {
    if (!isScheduled) return;
    await scheduleTask.mutateAsync({
      id: task.id,
      startDate: task.startDate!,
      durationDays: isAllDay ? (task.durationDays ?? 1) : 1,
      isAllDay,
      ...(isAllDay ? {} : { startTime, endTime }),
      recurrence,
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      setError("タイトルを入力してください");
      return;
    }

    const trimmedHours = estimatedHours.trim();
    const hours = trimmedHours === "" ? null : Number(trimmedHours);
    if (hours != null && (Number.isNaN(hours) || hours < MIN_ESTIMATED_HOURS || hours > MAX_ESTIMATED_HOURS)) {
      setError(`所要時間は${MIN_ESTIMATED_HOURS}〜${MAX_ESTIMATED_HOURS}時間で入力してください`);
      return;
    }

    let recurrence: RecurrenceInput | null = null;
    if (isScheduled) {
      if (!isAllDay) {
        try {
          validateTime(startTime);
          validateTime(endTime);
          validateTimeRange(startTime, endTime);
        } catch (err) {
          setError(messageForScheduleError(err));
          return;
        }
      }
      recurrence = buildRecurrenceInput();
      if (recurrence) {
        try {
          buildRecurrenceRule(recurrence, new Date(task.startDate!));
        } catch (err) {
          setError(messageForScheduleError(err));
          return;
        }
      }
    }

    try {
      const result = await guard.submit(trimmedTitle, {
        id: task.id,
        title: trimmedTitle,
        description,
        category: category.trim() || null,
        estimatedHours: hours,
        urgency,
        importance,
      });
      if (result === "ok") {
        await saveScheduleIfNeeded(recurrence);
        onClose();
      }
    } catch (err) {
      setError(messageForError(err));
    }
  }

  function handleRename() {
    guard.cancel();
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }

  async function handleCreateAnyway() {
    try {
      await guard.confirmCreateAnyway();
      await saveScheduleIfNeeded(isScheduled ? buildRecurrenceInput() : null);
      onClose();
    } catch (err) {
      setError(messageForError(err));
    }
  }

  async function handleUnschedule() {
    setError(null);
    try {
      await scheduleTask.mutateAsync({ id: task.id, startDate: null });
      onClose();
    } catch (err) {
      setError(messageForError(err));
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteTask.mutateAsync(task.id);
      onClose();
    } catch (err) {
      setError(messageForError(err));
    }
  }

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true">
      <div className="dialog">
        <div className="new-task-header">
          <h2>タスクの詳細</h2>
          <div className="new-task-header-ratings">
            <span className="rating-picker-label">
              緊急度
              <RatingPicker value={urgency} onChange={setUrgency} label="緊急度" />
            </span>
            <span className="rating-picker-label">
              重要度
              <RatingPicker value={importance} onChange={setImportance} label="重要度" />
            </span>
          </div>
        </div>
        <form onSubmit={handleSave} className="task-detail-form">
          <label>
            タイトル
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
            />
          </label>
          <label>
            説明
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={4}
            />
          </label>
          <label>
            カテゴリー
            <CategorySelect value={category} onChange={setCategory} />
          </label>
          <label>
            所要時間(時間)
            <input
              type="number"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              min={MIN_ESTIMATED_HOURS}
              max={MAX_ESTIMATED_HOURS}
              step={0.25}
              placeholder="未設定"
            />
          </label>

          {isScheduled && (
            <div className="task-schedule-form">
              <h3>予定の詳細</h3>
              <label className="task-schedule-form-checkbox">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                />
                終日
              </label>
              {!isAllDay && (
                <div className="task-schedule-form-row">
                  <label>
                    開始時刻
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </label>
                  <label>
                    終了時刻
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <label>
                繰り返し
                <select
                  value={recurrenceFreq}
                  onChange={(e) => setRecurrenceFreq(e.target.value as RecurrenceFreq | "")}
                >
                  <option value="">なし</option>
                  {RECURRENCE_FREQS.map((freq) => (
                    <option key={freq} value={freq}>
                      {RECURRENCE_FREQ_LABELS[freq]}
                    </option>
                  ))}
                </select>
              </label>
              {recurrenceFreq !== "" && (
                <div className="task-schedule-form-row">
                  <label>
                    間隔
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    終了日(任意)
                    <input
                      type="date"
                      value={recurrenceUntil}
                      onChange={(e) => setRecurrenceUntil(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions">
            <button type="submit" className="button button--primary" disabled={saving}>
              保存
            </button>
            {isScheduled && (
              <button type="button" className="button" onClick={handleUnschedule}>
                カレンダーから外す
              </button>
            )}
            <button type="button" className="button button--danger" onClick={handleDelete}>
              削除
            </button>
            <button type="button" className="button" onClick={onClose}>
              閉じる
            </button>
          </div>
        </form>

        {guard.pending && (
          <DuplicateTitleDialog
            title={guard.pending.title}
            onRename={handleRename}
            onCreateAnyway={handleCreateAnyway}
            busy={saving}
          />
        )}
      </div>
    </div>
  );
}
