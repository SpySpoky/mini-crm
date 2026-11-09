import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Guards all pages except /login.
export default function ProtectedRoute() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) return <p className="center-message">Загрузка...</p>;

  if (!session) return <Navigate to="/login" replace />;

  // Signed in, but there is no row in "profiles" for this user
  if (!profile) {
    return (
      <div className="center-message">
        <p>Профиль пользователя не найден. Обратитесь к администратору.</p>
        <button className="btn btn-secondary" onClick={signOut}>
          Выйти
        </button>
      </div>
    );
  }

  // Render the nested route (Layout + page)
  return <Outlet />;
}
