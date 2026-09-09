import { useRef, useState } from "react";
import { useCreateTask } from "../../hooks/useTasks";
import { useDuplicateTitleGuard } from "../../hooks/useDuplicateTitleGuard";
import { messageForError } from "../../lib/errors";
import {
  isMaliciousInput,
  MAX_ESTIMATED_HOURS,
  MAX_TITLE_LENGTH,
  MIN_ESTIMATED_HOURS,
} from "../../lib/validation";
import CategorySelect from "./CategorySelect";
import DuplicateTitleDialog from "./DuplicateTitleDialog";
import RatingPicker from "./RatingPicker";

interface Props {
  onClose: () => void;
}

export default function NewTaskForm({ onClose }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [urgency, setUrgency] = useState<number | null>(null);
  const [importance, setImportance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();
  const guard = useDuplicateTitleGuard(createTask.mutateAsync);

  const trimmedTitle = title.trim();
  const clientLooksInvalid =
    trimmedTitle.length > 0 &&
    (trimmedTitle.length > MAX_TITLE_LENGTH || isMaliciousInput(trimmedTitle));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (trimmedTitle.length === 0) {
      setError("タイトルを入力してください");
      return;
    }
    const hours = estimatedHours.trim() === "" ? null : Number(estimatedHours);
    if (hours != null && (Number.isNaN(hours) || hours < MIN_ESTIMATED_HOURS || hours > MAX_ESTIMATED_HOURS)) {
      setError(`所要時間は${MIN_ESTIMATED_HOURS}〜${MAX_ESTIMATED_HOURS}時間で入力してください`);
      return;
    }

    try {
      const result = await guard.submit(trimmedTitle, {
        title: trimmedTitle,
        category: category.trim() || null,
        estimatedHours: hours,
        urgency,
        importance,
      });
      if (result === "ok") onClose();
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
      onClose();
    } catch (err) {
      setError(messageForError(err));
    }
  }

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true">
      <div className="dialog">
        <div className="new-task-header">
          <h2>新しいタスクを追加</h2>
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
        <form onSubmit={handleSubmit} className="task-detail-form">
          <label>
            タイトル
            <input
              ref={titleInputRef}
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
              aria-label="タスクのタイトル"
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
              aria-label="タスクの所要時間"
            />
          </label>

          {clientLooksInvalid && <p className="form-hint">この内容は追加できない可能性があります</p>}
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions">
            <button type="submit" className="button button--primary" disabled={createTask.isPending}>
              追加
            </button>
            <button type="button" className="button" onClick={onClose}>
              キャンセル
            </button>
          </div>
        </form>

        {guard.pending && (
          <DuplicateTitleDialog
            title={guard.pending.title}
            onRename={handleRename}
            onCreateAnyway={handleCreateAnyway}
            busy={createTask.isPending}
          />
        )}
      </div>
    </div>
  );
}
