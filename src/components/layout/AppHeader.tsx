export type Tab = "calendar" | "settings" | "history";

interface Props {
  tab: Tab;
  onChange: (tab: Tab) => void;
  userEmail: string;
  onLogout: () => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "calendar", label: "カレンダー" },
  { key: "settings", label: "設定" },
  { key: "history", label: "操作履歴" },
];

export default function AppHeader({ tab, onChange, userEmail, onLogout }: Props) {
  return (
    <header className="app-header">
      <h1 className="app-title">Task × Calendar</h1>
      <nav className="app-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`app-nav-button${tab === t.key ? " app-nav-button--active" : ""}`}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="app-user">
        <span className="app-user-email">{userEmail}</span>
        <button type="button" className="app-logout-button" onClick={onLogout}>
          ログアウト
        </button>
      </div>
    </header>
  );
}
