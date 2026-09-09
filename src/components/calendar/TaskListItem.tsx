import type { Task } from "../../api/client";
import { categoryColor } from "../../lib/categoryColor";
import { formatEstimatedHours } from "../../lib/estimatedHours";

interface Props {
  task: Task;
  onClick: () => void;
  dragging?: boolean;
}

export default function TaskListItem({ task, onClick, dragging }: Props) {
  // Mirrors buildEvent()'s shape (id + extendedProps.urgency) so the event
  // FullCalendar shows the instant it's dropped already sorts correctly —
  // otherwise it briefly renders with no urgency (sorting last), which on
  // an all-day cell already at the dayMaxEvents cap can put it behind the
  // "+N more" link until the real task data replaces it a moment later.
  const eventPayload = JSON.stringify({
    id: task.id,
    title: task.title,
    duration: { days: 1 },
    extendedProps: { taskId: task.id, urgency: task.urgency },
  });

  return (
    <li
      className={`task-list-item${dragging ? " task-list-item--dragging" : ""}`}
      data-event={eventPayload}
      data-task-id={task.id}
      onClick={onClick}
    >
      <span className="task-list-item-title">{task.title}</span>
      <span className="task-list-item-badges">
        {task.urgency != null && <span className="hours-badge">緊急{task.urgency}</span>}
        {task.importance != null && <span className="hours-badge">重要{task.importance}</span>}
        {task.estimatedHours != null && (
          <span className="hours-badge">{formatEstimatedHours(task.estimatedHours)}</span>
        )}
        {task.category && (
          <span
            className="category-badge"
            style={{
              background: categoryColor(task.category).background,
              borderColor: categoryColor(task.category).border,
              color: categoryColor(task.category).text,
            }}
          >
            {task.category}
          </span>
        )}
      </span>
    </li>
  );
}
