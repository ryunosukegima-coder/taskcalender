import { useState } from "react";
import AppHeader, { type Tab } from "./components/layout/AppHeader";
import CalendarPage from "./components/calendar/CalendarPage";
import SettingsPage from "./components/settings/SettingsPage";
import HistoryPage from "./components/history/HistoryPage";
import LoginPage from "./components/auth/LoginPage";
import { useSettings } from "./hooks/useSettings";
import { useAuthUser, useLogout } from "./hooks/useAuth";

export default function App() {
  const [tab, setTab] = useState<Tab>("calendar");
  const { data: user, isLoading: authLoading } = useAuthUser();
  const logout = useLogout();
  const { data: settings } = useSettings(!!user);
  const taskFeatureEnabled = settings?.taskFeatureEnabled ?? true;

  if (authLoading) {
    return <div className="app-loading">読み込み中...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <AppHeader
        tab={tab}
        onChange={setTab}
        userEmail={user.email}
        onLogout={() => logout.mutate()}
      />
      <main className="app-main">
        {tab === "calendar" && <CalendarPage taskFeatureEnabled={taskFeatureEnabled} />}
        {tab === "settings" && <SettingsPage />}
        {tab === "history" && <HistoryPage />}
      </main>
    </div>
  );
}
