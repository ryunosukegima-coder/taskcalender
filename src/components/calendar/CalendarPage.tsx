import { useState } from "react";
import type { Task } from "../../api/client";
import CalendarView from "./CalendarView";
import TaskListPanel from "./TaskListPanel";
import TaskDetailModal from "./TaskDetailModal";

interface Props {
  taskFeatureEnabled: boolean;
}

export default function CalendarPage({ taskFeatureEnabled }: Props) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  function showBanner(message: string) {
    setBanner(message);
    window.setTimeout(() => setBanner(null), 4000);
  }

  return (
    <div className={`calendar-page${taskFeatureEnabled ? "" : " calendar-page--calendar-only"}`}>
      {banner && <div className="banner banner--error">{banner}</div>}
      <div className="calendar-page-layout">
        {taskFeatureEnabled && (
          <TaskListPanel onSelectTask={setSelectedTask} onError={showBanner} />
        )}
        <CalendarView onSelectTask={setSelectedTask} onError={showBanner} />
      </div>
      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
