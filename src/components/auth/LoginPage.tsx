import { useState } from "react";
import { useLogin, useSignup } from "../../hooks/useAuth";
import { messageForError } from "../../lib/errors";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();
  const signup = useSignup();
  const pending = login.isPending || signup.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "login") {
        await login.mutateAsync({ email, password });
      } else {
        await signup.mutateAsync({ email, password });
      }
    } catch (err) {
      setError(messageForError(err));
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1 className="auth-title">Task × Calendar</h1>
        <p className="auth-subtitle">
          {mode === "login" ? "ログインしてください" : "アカウントを作成してください"}
        </p>
        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </label>
        <label>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="button button--primary" disabled={pending}>
          {mode === "login" ? "ログイン" : "登録する"}
        </button>

        <button
          type="button"
          className="auth-switch-mode"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "アカウントをお持ちでない方はこちら" : "既にアカウントをお持ちの方はこちら"}
        </button>
      </form>
    </div>
  );
}
