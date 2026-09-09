import { useState } from "react";
import { useHistory } from "../../hooks/useHistory";
import type { HistoryEntry } from "../../api/client";

const ACTION_LABELS: Record<string, string> = {
  TASK_CREATED: "タスクを作成",
  TASK_UPDATED: "タスクを更新",
  TASK_DELETED: "タスクを削除",
  TASK_SCHEDULED: "タスクをカレンダーに配置",
  TASK_RESCHEDULED: "タスクの予定を変更",
  TASK_UNSCHEDULED: "タスクをカレンダーから外した",
  SETTINGS_UPDATED: "設定を変更",
};

function formatEntry(entry: HistoryEntry): string {
  return ACTION_LABELS[entry.action] ?? entry.action;
}

export default function HistoryPage() {
  const [days, setDays] = useState(7);
  const { data: entries, isLoading } = useHistory(days);

  return (
    <div className="history-page">
      <h2>操作履歴</h2>
      <label>
        表示期間:
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={3}>過去3日</option>
          <option value={7}>過去7日</option>
          <option value={30}>過去30日</option>
        </select>
      </label>
      {isLoading && <p>読み込み中...</p>}
      <ul className="history-list">
        {entries?.map((entry) => (
          <li key={entry.id} className="history-item">
            <span className="history-item-action">{formatEntry(entry)}</span>
            <span className="history-item-time">
              {new Date(entry.createdAt).toLocaleString("ja-JP")}
            </span>
          </li>
        ))}
        {entries?.length === 0 && <li className="history-empty">履歴はありません</li>}
      </ul>
    </div>
  );
}
