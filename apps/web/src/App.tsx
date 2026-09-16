import { Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import RoomPage from "./pages/RoomPage";
import { ToastProvider } from "./components/ui";

export default function App() {
  return (
    <ToastProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/r/:slug" element={<RoomPage />} />
      <Route path="/" element={<DashboardPage />} />
    </Routes>
    </ToastProvider>
  );
}
