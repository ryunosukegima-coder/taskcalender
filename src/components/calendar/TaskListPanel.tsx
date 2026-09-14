import { useEffect, useMemo, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { useUnscheduledTasks, useUpdateTask } from "../../hooks/useTasks";
import type { Task } from "../../api/client";
import { messageForError } from "../../lib/errors";
import { categoryColor, UNCATEGORIZED_LABEL } from "../../lib/categoryColor";
import NewTaskForm from "./NewTaskForm";
import TaskListItem from "./TaskListItem";

interface Props {
  onSelectTask: (task: Task) => void;
  onError: (message: string) => void;
}

interface CategoryGroup {
  category: string | null;
  label: string;
  tasks: Task[];
}

// "" stands for the uncategorized group throughout this file, matching the
// map key groupByCategory already uses (task.category is null there).
const UNCATEGORIZED_KEY = "";
const DRAG_THRESHOLD_PX = 6;

// On phone-width layouts the task list sits above the calendar (see the
// mobile stylesheet), so a drag that starts in the list can easily begin
// before the calendar has scrolled into view — there's nowhere on-screen
// to drop onto yet. A touch-and-hold nudges the page to reveal the
// calendar (below this width; side-by-side desktop layouts never need it)
// while the FullCalendar Draggable's own longer press-delay is still
// counting down, so by the time it actually starts dragging the calendar
// is already in view underneath the finger.
const MOBILE_LAYOUT_QUERY = "(max-width: 768px)";
const LONG_PRESS_MS = 450;

// Ascending by urgency (1..5); tasks with no urgency set sort after every
// task that has one, tasks tied on urgency keep their incoming (createdAt
// desc) order.
function compareByUrgency(a: Task, b: Task): number {
  if (a.urgency == null && b.urgency == null) return 0;
  if (a.urgency == null) return 1;
  if (b.urgency == null) return -1;
  return a.urgency - b.urgency;
}

// Uncategorized tasks are always shown last; categorized groups are ordered
// alphabetically so the section order stays stable as tasks are added.
function groupByCategory(tasks: Task[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const task of tasks) {
    const key = task.category ?? UNCATEGORIZED_KEY;
    if (!groups.has(key)) {
      groups.set(key, {
        category: task.category,
        label: task.category ?? UNCATEGORIZED_LABEL,
        tasks: [],
      });
    }
    groups.get(key)!.tasks.push(task);
  }
  for (const group of groups.values()) {
    group.tasks.sort(compareByUrgency);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.category == null) return 1;
    if (b.category == null) return -1;
    return a.category.localeCompare(b.category, "ja");
  });
}

// Bounding-rect hit testing (rather than elementFromPoint) so the drop
// target is found correctly even while FullCalendar's own drag mirror is
// floating under the cursor for the calendar-scheduling drag below.
function findGroupKeyAt(container: HTMLElement, x: number, y: number): string | undefined {
  const groupEls = container.querySelectorAll<HTMLElement>(".task-list-group");
  for (const el of groupEls) {
    const rect = el.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return el.dataset.category;
    }
  }
  return undefined;
}

export default function TaskListPanel({ onSelectTask, onError }: Props) {
  const { data: tasks, isLoading } = useUnscheduledTasks();
  const updateTask = useUpdateTask();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    taskId: string;
    fromCategoryKey: string;
    moved: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [hoverGroupKey, setHoverGroupKey] = useState<string | undefined>(undefined);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  // Set right before a dragged item's pointerup, so the native "click" that
  // follows a drag-and-drop-back-onto-itself gesture doesn't open the detail
  // modal. Cleared by the click handler itself, so it never lingers.
  const suppressClickRef = useRef(false);
  const [liftedTaskId, setLiftedTaskId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  function clearLongPress() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLiftedTaskId(null);
  }

  const groups = useMemo(() => groupByCategory(tasks ?? []), [tasks]);

  useEffect(() => {
    if (!listContainerRef.current) return;
    const draggable = new Draggable(listContainerRef.current, {
      itemSelector: ".task-list-item",
    });
    return () => draggable.destroy();
  }, []);

  // This tracks drag-to-recategorize (dropping a task on a different
  // category section) independently of FullCalendar's own Draggable above,
  // which separately tracks the same press-and-move gesture for dropping a
  // task onto the calendar to schedule it. Neither interferes with the
  // other: this one only acts when the pointer is released over a
  // `.task-list-group`, which never overlaps the calendar.
  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      const container = listContainerRef.current;
      if (!drag || !container) return;
      if (!drag.moved) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        setDraggingTaskId(drag.taskId);
      }
      setHoverGroupKey(findGroupKeyAt(container, e.clientX, e.clientY));
    }

    function handlePointerUp(e: PointerEvent) {
      const drag = dragRef.current;
      const container = listContainerRef.current;
      dragRef.current = null;
      setDraggingTaskId(null);
      setHoverGroupKey(undefined);
      clearLongPress();
      if (!drag) return;
      if (drag.moved) suppressClickRef.current = true;
      if (!drag.moved || !container) return;

      const targetKey = findGroupKeyAt(container, e.clientX, e.clientY);
      if (targetKey === undefined || targetKey === drag.fromCategoryKey) return;

      updateTask
        .mutateAsync({ id: drag.taskId, category: targetKey || null })
        .catch((err) => onError(messageForError(err)));
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTask, onError]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const itemEl = (e.target as HTMLElement).closest<HTMLElement>(".task-list-item");
    const taskId = itemEl?.dataset.taskId;
    if (!taskId) return;
    const task = tasks?.find((t) => t.id === taskId);
    if (!task) return;
    dragRef.current = {
      taskId,
      fromCategoryKey: task.category ?? UNCATEGORIZED_KEY,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };

    if (e.pointerType === "touch" && window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
      longPressTimerRef.current = window.setTimeout(() => {
        setLiftedTaskId(taskId);
        navigator.vibrate?.(30);
        document
          .querySelector(".calendar-view")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, LONG_PRESS_MS);
    }
  }

  function handleItemClick(task: Task) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelectTask(task);
  }

  return (
    <aside className="task-list-panel">
      <div className="task-list-panel-header">
        <h2>タスク</h2>
        <button
          type="button"
          className="button button--primary task-list-add-button"
          onClick={() => setNewTaskOpen(true)}
        >
          + タスクを追加
        </button>
      </div>
      {newTaskOpen && <NewTaskForm onClose={() => setNewTaskOpen(false)} />}
      {isLoading && <p>読み込み中...</p>}
      <div ref={listContainerRef} onPointerDown={handlePointerDown}>
        {groups.map((group) => {
          const key = group.category ?? UNCATEGORIZED_KEY;
          return (
            <div
              key={key}
              className={`task-list-group${hoverGroupKey === key ? " task-list-group--drop-target" : ""}`}
              data-category={key}
            >
              <h3
                className="task-list-group-title"
                style={{ color: categoryColor(group.category).text }}
              >
                <span
                  className="category-dot"
                  style={{ background: categoryColor(group.category).border }}
                />
                {group.label}
              </h3>
              <ul className="task-list">
                {group.tasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onClick={() => handleItemClick(task)}
                    dragging={task.id === draggingTaskId}
                    lifted={task.id === liftedTaskId}
                  />
                ))}
              </ul>
            </div>
          );
        })}
        {tasks?.length === 0 && <p className="task-list-empty">タスクはありません</p>}
      </div>
      <p className="task-list-hint">
        タスクをカレンダーにドラッグして予定を組めます。別のカテゴリー欄にドラッグすると分類を変更できます。
      </p>
    </aside>
  );
}
