import { useSettings, useUpdateSettings } from "../../hooks/useSettings";
import { messageForError } from "../../lib/errors";
import { useState } from "react";

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (!settings) return;
    setError(null);
    try {
      await updateSettings.mutateAsync({ taskFeatureEnabled: !settings.taskFeatureEnabled });
    } catch (err) {
      setError(messageForError(err));
    }
  }

  if (isLoading || !settings) return <p>読み込み中...</p>;

  return (
    <div className="settings-page">
      <h2>設定</h2>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={settings.taskFeatureEnabled}
          onChange={handleToggle}
          disabled={updateSettings.isPending}
        />
        タスク機能を有効にする
      </label>
      <p className="settings-hint">
        オフにするとカレンダーのみの表示になります。すでに予定されているタスクはカレンダーに残ります。
      </p>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
