import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../types";

const ROLE_LABELS: Record<UserRole, string> = {
  manager: "Постановщик",
  executor: "Исполнитель",
};

// Header + page content for all protected pages.
export default function Layout() {
  const { profile, isManager, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <span className="logo">Мини-CRM</span>

          <nav className="nav">
            <NavLink to="/objects" end>Объекты</NavLink>
            {!isManager && <NavLink to="/my-tasks">Мои задачи</NavLink>}
          </nav>

          <div className="user">
            {profile && (
              <span>
                {profile.full_name} <span className="muted">({ROLE_LABELS[profile.role]})</span>
              </span>
            )}
            <button className="btn btn-secondary" onClick={handleSignOut}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
