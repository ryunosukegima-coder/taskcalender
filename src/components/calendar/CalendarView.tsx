import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import rrulePlugin from "@fullcalendar/rrule";
import type { DateSelectArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type {
  EventDragStopArg,
  EventReceiveArg,
  EventResizeDoneArg,
} from "@fullcalendar/interaction";
import { useCreateTask, useScheduleTask, useTasks } from "../../hooks/useTasks";
import { ApiRequestError, messageForError } from "../../lib/errors";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_DURATION_DAYS,
  MAX_ESTIMATED_HOURS,
  MAX_TITLE_LENGTH,
  MIN_DURATION_DAYS,
  MIN_ESTIMATED_HOURS,
  parseRecurrenceRule,
  validateTime,
  validateTimeRange,
  ValidationError,
} from "../../lib/validation";
import type { Task } from "../../api/client";
import CategorySelect from "./CategorySelect";
import DuplicateTitleDialog from "./DuplicateTitleDialog";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "10:00";

interface Props {
  onSelectTask: (task: Task) => void;
  onError: (message: string) => void;
}

// The task list lives in a sibling component (TaskListPanel), so dragging a
// calendar event back onto it is detected by cursor position against its
// DOM node rather than through React props.
function isPointOverTaskListPanel(x: number, y: number): boolean {
  const panel = document.querySelector(".task-list-panel");
  if (!panel) return false;
  const rect = panel.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));
}

function combineDateAndTime(dateLike: string | Date, time: string): Date {
  const d = new Date(dateLike);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes);
}

function formatTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function minutesBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function formatDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Parsed manually (rather than `new Date(value)`) because a bare "YYYY-MM-DD"
// string is parsed as UTC midnight by the Date constructor, which can shift
// to the previous day once converted to the browser's local timezone.
function parseDateInputValue(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function buildEvent(t: Task): EventInput {
  const durationDays = t.durationDays ?? 1;
  const recurrence = parseRecurrenceRule(t.recurrenceRule);
  const base: EventInput = {
    id: t.id,
    title: t.title,
    allDay: t.isAllDay,
    extendedProps: { taskId: t.id, urgency: t.urgency },
  };

  if (recurrence) {
    const dtstart = t.isAllDay
      ? new Date(t.startDate!)
      : combineDateAndTime(t.startDate!, t.startTime ?? "00:00");
    const duration = t.isAllDay
      ? { days: durationDays }
      : { minutes: minutesBetween(t.startTime ?? "00:00", t.endTime ?? "00:00") };
    return {
      ...base,
      rrule: {
        freq: recurrence.freq.toLowerCase(),
        interval: recurrence.interval,
        dtstart,
        ...(recurrence.until ? { until: recurrence.until } : {}),
      },
      duration,
    };
  }

  const start = t.isAllDay
    ? new Date(t.startDate!)
    : combineDateAndTime(t.startDate!, t.startTime ?? "00:00");
  const end = t.isAllDay
    ? new Date(start.getTime() + durationDays * MS_PER_DAY)
    : combineDateAndTime(t.startDate!, t.endTime ?? t.startTime ?? "00:00");

  return { ...base, start, end };
}

export default function CalendarView({ onSelectTask, onError }: Props) {
  const { data: tasks } = useTasks();
  const scheduleTask = useScheduleTask();
  const createTask = useCreateTask();
  const calendarRef = useRef<FullCalendar>(null);
  const eventDragMoveListenerRef = useRef<((e: PointerEvent) => void) | null>(null);

  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("");
  const [newTaskEstimatedHours, setNewTaskEstimatedHours] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskAllDay, setNewTaskAllDay] = useState(true);
  const [newTaskDurationDays, setNewTaskDurationDays] = useState(1);
  const [newTaskStartTime, setNewTaskStartTime] = useState(DEFAULT_START_TIME);
  const [newTaskEndTime, setNewTaskEndTime] = useState(DEFAULT_END_TIME);
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState<string | null>(null);
  const newTaskBusy = createTask.isPending || scheduleTask.isPending;

  const events = useMemo(
    () => (tasks ?? []).filter((t) => t.startDate != null).map(buildEvent),
    [tasks],
  );

  async function commitSchedule(
    taskId: string,
    start: Date,
    end: Date | null,
    isAllDay: boolean,
    revert: () => void,
    estimatedHours?: number | null,
  ) {
    if (isAllDay) {
      const durationDays = end ? daysBetween(start, end) : 1;
      if (durationDays > MAX_DURATION_DAYS) {
        onError(`予定期間は${MAX_DURATION_DAYS}日以内にしてください`);
        revert();
        return;
      }
      try {
        await scheduleTask.mutateAsync({
          id: taskId,
          startDate: start.toISOString(),
          durationDays,
        });
      } catch (err) {
        onError(messageForError(err));
        revert();
      }
      return;
    }

    // No end means a fresh drop from the unscheduled list (see
    // handleEventReceive) rather than a real move/resize; default its
    // length to the task's own estimate instead of always 1h.
    const defaultDurationMs =
      estimatedHours != null ? estimatedHours * 60 * 60 * 1000 : 60 * 60 * 1000;
    const endTime = end ?? new Date(start.getTime() + defaultDurationMs);
    try {
      await scheduleTask.mutateAsync({
        id: taskId,
        startDate: start.toISOString(),
        durationDays: 1,
        isAllDay: false,
        startTime: formatTime(start),
        endTime: formatTime(endTime),
      });
    } catch (err) {
      onError(messageForError(err));
      revert();
    }
  }

  // Recurring events are edited as a whole series: dragging shifts every
  // occurrence by the same delta, resizing changes every occurrence's length.
  async function shiftRecurringSeries(task: Task, deltaMs: number) {
    const anchor = task.isAllDay
      ? new Date(task.startDate!)
      : combineDateAndTime(task.startDate!, task.startTime!);
    const newAnchor = new Date(anchor.getTime() + deltaMs);

    if (task.isAllDay) {
      await scheduleTask.mutateAsync({
        id: task.id,
        startDate: newAnchor.toISOString(),
        durationDays: task.durationDays ?? 1,
      });
      return;
    }

    const durationMinutes = minutesBetween(task.startTime!, task.endTime!);
    const newEnd = new Date(newAnchor.getTime() + durationMinutes * 60000);
    await scheduleTask.mutateAsync({
      id: task.id,
      startDate: newAnchor.toISOString(),
      durationDays: 1,
      isAllDay: false,
      startTime: formatTime(newAnchor),
      endTime: formatTime(newEnd),
    });
  }

  async function resizeRecurringSeries(task: Task, newEnd: Date) {
    if (task.isAllDay) {
      const start = new Date(task.startDate!);
      const durationDays = Math.max(1, Math.round((newEnd.getTime() - start.getTime()) / MS_PER_DAY));
      if (durationDays > MAX_DURATION_DAYS) {
        onError(`予定期間は${MAX_DURATION_DAYS}日以内にしてください`);
        return;
      }
      await scheduleTask.mutateAsync({ id: task.id, startDate: task.startDate!, durationDays });
      return;
    }
    await scheduleTask.mutateAsync({
      id: task.id,
      startDate: task.startDate!,
      durationDays: 1,
      isAllDay: false,
      startTime: task.startTime!,
      endTime: formatTime(newEnd),
    });
  }

  function handleEventReceive(info: EventReceiveArg) {
    const taskId = info.event.extendedProps.taskId as string;
    const task = tasks?.find((t) => t.id === taskId);
    // The dragged sidebar item declares a 1-*day* duration hint (needed so a
    // month-view drop spans one day); FullCalendar applies that literally
    // even for a timed drop, giving an `end` exactly 24h after `start` —
    // never a useful time-of-day. Only trust it for an all-day drop.
    const end = info.event.allDay ? info.event.end : null;
    void commitSchedule(
      taskId,
      info.event.start!,
      end,
      info.event.allDay,
      () => info.revert(),
      task?.estimatedHours,
    );
  }

  function handleEventDrop(info: EventDropArg) {
    const taskId = info.event.extendedProps.taskId as string;
    const task = tasks?.find((t) => t.id === taskId);
    if (task?.recurrenceRule) {
      const deltaMs = info.event.start!.getTime() - info.oldEvent.start!.getTime();
      shiftRecurringSeries(task, deltaMs).catch((err) => {
        onError(messageForError(err));
        info.revert();
      });
      return;
    }
    // Dragging an all-day event onto a timed slot leaves FullCalendar's own
    // `end` at its default 1h guess, discarding the task's real estimate —
    // same problem handleEventReceive works around for sidebar drops. Null
    // it out only for that transition so commitSchedule falls back to the
    // task's estimatedHours; an ordinary timed-to-timed drag keeps its
    // existing duration as-is.
    const cameFromAllDay = info.oldEvent.allDay && !info.event.allDay;
    void commitSchedule(
      taskId,
      info.event.start!,
      cameFromAllDay ? null : info.event.end,
      info.event.allDay,
      () => info.revert(),
      task?.estimatedHours,
    );
  }

  function handleEventResize(info: EventResizeDoneArg) {
    const taskId = info.event.extendedProps.taskId as string;
    const task = tasks?.find((t) => t.id === taskId);
    if (task?.recurrenceRule) {
      resizeRecurringSeries(task, info.event.end!).catch((err) => {
        onError(messageForError(err));
        info.revert();
      });
      return;
    }
    void commitSchedule(
      taskId,
      info.event.start!,
      info.event.end,
      info.event.allDay,
      () => info.revert(),
    );
  }

  function handleEventClick(taskId: string) {
    const task = tasks?.find((t) => t.id === taskId);
    if (task) onSelectTask(task);
  }

  // Highlights the task list while an event is being dragged over it, as a
  // drop target for unscheduling — mirrors the drop-target highlight
  // TaskListPanel already shows for its own within-panel drags.
  function handleEventDragStart() {
    const panel = document.querySelector(".task-list-panel");
    const listener = (e: PointerEvent) => {
      panel?.classList.toggle("task-list-panel--drop-target", isPointOverTaskListPanel(e.clientX, e.clientY));
    };
    eventDragMoveListenerRef.current = listener;
    window.addEventListener("pointermove", listener);
  }

  function handleEventDragStop(info: EventDragStopArg) {
    if (eventDragMoveListenerRef.current) {
      window.removeEventListener("pointermove", eventDragMoveListenerRef.current);
      eventDragMoveListenerRef.current = null;
    }
    document.querySelector(".task-list-panel")?.classList.remove("task-list-panel--drop-target");

    const { clientX, clientY } = info.jsEvent;
    if (!isPointOverTaskListPanel(clientX, clientY)) return;

    const taskId = info.event.extendedProps.taskId as string;
    // Even with dragRevertDuration={0}, FullCalendar still shows the event
    // back at its original slot for a beat while our mutation round-trips
    // (its own revert isn't tied to that request). Removing it from
    // FullCalendar's own store immediately avoids that flash; if the
    // mutation fails, the query rollback restores the task's startDate,
    // which brings the event back through the normal `events` prop.
    info.event.remove();
    scheduleTask.mutateAsync({ id: taskId, startDate: null }).catch((err) => {
      onError(messageForError(err));
    });
  }

  function openNewTaskDialog(defaults?: {
    date: Date;
    allDay: boolean;
    durationDays?: number;
    startTime?: string;
    endTime?: string;
  }) {
    const base = defaults ?? {
      date: calendarRef.current?.getApi().getDate() ?? new Date(),
      allDay: true,
    };
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskCategory("");
    setNewTaskEstimatedHours("");
    setNewTaskDate(formatDateInputValue(base.date));
    setNewTaskAllDay(base.allDay);
    setNewTaskDurationDays(base.durationDays ?? 1);
    setNewTaskStartTime(base.startTime ?? DEFAULT_START_TIME);
    setNewTaskEndTime(base.endTime ?? DEFAULT_END_TIME);
    setNewTaskError(null);
    setDuplicateTitle(null);
    setNewTaskOpen(true);
  }

  function handleSelect(info: DateSelectArg) {
    if (info.allDay) {
      openNewTaskDialog({
        date: info.start,
        allDay: true,
        durationDays: daysBetween(info.start, info.end),
      });
    } else {
      openNewTaskDialog({
        date: info.start,
        allDay: false,
        startTime: formatTime(info.start),
        endTime: formatTime(info.end),
      });
    }
  }

  function closeNewTaskDialog() {
    calendarRef.current?.getApi().unselect();
    setNewTaskOpen(false);
    setDuplicateTitle(null);
  }

  // Creates the task and schedules it in one go; `force` bypasses the
  // duplicate-title check after the user confirms via the dialog.
  async function createAndScheduleNewTask(title: string, force: boolean) {
    const startDate = parseDateInputValue(newTaskDate);
    const created = await createTask.mutateAsync({
      title,
      description: newTaskDescription.trim() || null,
      category: newTaskCategory.trim() || null,
      estimatedHours: newTaskEstimatedHours.trim() === "" ? null : Number(newTaskEstimatedHours),
      force,
    });
    if (newTaskAllDay) {
      await scheduleTask.mutateAsync({
        id: created.id,
        startDate: startDate.toISOString(),
        durationDays: newTaskDurationDays,
      });
    } else {
      await scheduleTask.mutateAsync({
        id: created.id,
        startDate: startDate.toISOString(),
        durationDays: 1,
        isAllDay: false,
        startTime: newTaskStartTime,
        endTime: newTaskEndTime,
      });
    }
  }

  async function handleNewTaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNewTaskError(null);
    const trimmed = newTaskTitle.trim();
    if (trimmed.length === 0) {
      setNewTaskError("タイトルを入力してください");
      return;
    }
    if (!newTaskDate) {
      setNewTaskError("日付を選択してください");
      return;
    }
    const trimmedHours = newTaskEstimatedHours.trim();
    const hours = trimmedHours === "" ? null : Number(trimmedHours);
    if (hours != null && (Number.isNaN(hours) || hours < MIN_ESTIMATED_HOURS || hours > MAX_ESTIMATED_HOURS)) {
      setNewTaskError(`所要時間は${MIN_ESTIMATED_HOURS}〜${MAX_ESTIMATED_HOURS}時間で入力してください`);
      return;
    }
    if (newTaskAllDay) {
      if (newTaskDurationDays < MIN_DURATION_DAYS || newTaskDurationDays > MAX_DURATION_DAYS) {
        setNewTaskError(`期間は${MIN_DURATION_DAYS}〜${MAX_DURATION_DAYS}日にしてください`);
        return;
      }
    } else {
      try {
        validateTime(newTaskStartTime);
        validateTime(newTaskEndTime);
        validateTimeRange(newTaskStartTime, newTaskEndTime);
      } catch (err) {
        setNewTaskError(err instanceof ValidationError ? err.message : messageForError(err));
        return;
      }
    }

    try {
      await createAndScheduleNewTask(trimmed, false);
      closeNewTaskDialog();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "DUPLICATE_TITLE") {
        setDuplicateTitle(trimmed);
      } else {
        setNewTaskError(messageForError(err));
      }
    }
  }

  async function handleNewTaskCreateAnyway() {
    if (!duplicateTitle) return;
    try {
      await createAndScheduleNewTask(duplicateTitle, true);
      closeNewTaskDialog();
    } catch (err) {
      setNewTaskError(messageForError(err));
    }
  }

  return (
    <div className="calendar-view">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay addTask",
        }}
        customButtons={{
          addTask: {
            text: "+",
            click: () => openNewTaskDialog(),
          },
        }}
        editable
        droppable
        selectable
        // Dragging a task off the calendar onto the task list panel (or any
        // other rejected drop) is handled entirely by our own mutation —
        // skip FullCalendar's default snap-back animation to the original
        // slot, which otherwise flashes before the event actually removed.
        dragRevertDuration={0}
        select={handleSelect}
        // Time grid (week/day) shows 10-minute lines for fine-grained
        // placement/drag, but keeps labels hourly so it stays readable.
        slotDuration="00:10:00"
        slotLabelInterval="01:00:00"
        // Explicitly (rather than relying on FullCalendar's incidental
        // start-time-based default) guarantee that no-time tasks always
        // render above timed tasks within the same day cell; within that,
        // sort ascending by urgency (1..5, unset urgency sorts last per
        // FullCalendar's flexibleCompare), then start time as a tiebreaker.
        eventOrder="-allDay,urgency,start"
        // Caps how many events render per day cell — including the all-day
        // row in week/day view, which otherwise grows without bound and
        // gets sluggish once a day accumulates a lot of tasks. Anything
        // past the 10th collapses into a "+N more" link instead.
        dayMaxEvents={10}
        events={events}
        eventReceive={handleEventReceive}
        eventDrop={handleEventDrop}
        eventDragStart={handleEventDragStart}
        eventDragStop={handleEventDragStop}
        eventResize={handleEventResize}
        eventClick={(info) => handleEventClick(info.event.extendedProps.taskId as string)}
        height="auto"
      />

      {newTaskOpen && (
        <div className="dialog-overlay" role="dialog" aria-modal="true">
          <div className="dialog">
            <h2>新しい予定を追加</h2>
            <form onSubmit={handleNewTaskSubmit} className="task-detail-form">
              <label>
                タイトル
                <input
                  autoFocus
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  maxLength={MAX_TITLE_LENGTH}
                />
              </label>
              <label>
                説明
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  rows={3}
                />
              </label>
              <label>
                カテゴリー
                <CategorySelect value={newTaskCategory} onChange={setNewTaskCategory} />
              </label>
              <label>
                所要時間(時間)
                <input
                  type="number"
                  value={newTaskEstimatedHours}
                  onChange={(e) => setNewTaskEstimatedHours(e.target.value)}
                  min={MIN_ESTIMATED_HOURS}
                  max={MAX_ESTIMATED_HOURS}
                  step={0.25}
                  placeholder="未設定"
                />
              </label>

              <div className="task-schedule-form">
                <label className="task-schedule-form-checkbox">
                  <input
                    type="checkbox"
                    checked={newTaskAllDay}
                    onChange={(e) => setNewTaskAllDay(e.target.checked)}
                  />
                  終日
                </label>
                <div className="task-schedule-form-row">
                  <label>
                    日付
                    <input
                      type="date"
                      value={newTaskDate}
                      onChange={(e) => setNewTaskDate(e.target.value)}
                    />
                  </label>
                  {newTaskAllDay && (
                    <label>
                      期間(日数)
                      <input
                        type="number"
                        min={MIN_DURATION_DAYS}
                        max={MAX_DURATION_DAYS}
                        value={newTaskDurationDays}
                        onChange={(e) => setNewTaskDurationDays(Number(e.target.value))}
                      />
                    </label>
                  )}
                </div>
                {!newTaskAllDay && (
                  <div className="task-schedule-form-row">
                    <label>
                      開始時刻
                      <input
                        type="time"
                        value={newTaskStartTime}
                        onChange={(e) => setNewTaskStartTime(e.target.value)}
                      />
                    </label>
                    <label>
                      終了時刻
                      <input
                        type="time"
                        value={newTaskEndTime}
                        onChange={(e) => setNewTaskEndTime(e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </div>

              {newTaskError && <p className="form-error">{newTaskError}</p>}
              <div className="dialog-actions">
                <button type="submit" className="button button--primary" disabled={newTaskBusy}>
                  追加
                </button>
                <button type="button" className="button" onClick={closeNewTaskDialog}>
                  キャンセル
                </button>
              </div>
            </form>

            {duplicateTitle && (
              <DuplicateTitleDialog
                title={duplicateTitle}
                onRename={() => setDuplicateTitle(null)}
                onCreateAnyway={handleNewTaskCreateAnyway}
                busy={newTaskBusy}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
