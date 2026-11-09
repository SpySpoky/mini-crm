import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { toRussianError } from "../lib/errors";

export default function LoginPage() {
  const { session, profile, loading, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="center-message">Загрузка...</p>;

  // Already signed in: executor -> his tasks, everyone else -> objects
  // (if the profile is missing, /objects shows the "profile not found" message)
  if (session) {
    return <Navigate to={profile?.role === "executor" ? "/my-tasks" : "/objects"} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const errorMessage = await signIn(email.trim(), password);

    if (errorMessage) {
      setError(toRussianError({ message: errorMessage }));
      setSubmitting(false);
    }
    // On success the session changes and the redirect above happens.
  }

  return (
    <div className="login-box">
      <h1>Мини-CRM</h1>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
