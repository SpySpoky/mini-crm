import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import ObjectsPage from "./pages/ObjectsPage";
import ObjectPage from "./pages/ObjectPage";
import TaskPage from "./pages/TaskPage";
import MyTasksPage from "./pages/MyTasksPage";

// Unknown URL: signed in -> /objects, otherwise -> /login
function FallbackRedirect() {
  const { session, loading } = useAuth();
  if (loading) return <p className="center-message">Загрузка...</p>;
  return <Navigate to={session ? "/objects" : "/login"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Everything inside needs a signed-in user with a profile */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/objects" element={<ObjectsPage />} />
            <Route path="/objects/:id" element={<ObjectPage />} />
            <Route path="/tasks/:id" element={<TaskPage />} />
            <Route path="/my-tasks" element={<MyTasksPage />} />
          </Route>
        </Route>

        <Route path="*" element={<FallbackRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
