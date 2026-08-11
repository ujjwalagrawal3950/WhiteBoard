import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import WhiteboardPage from './pages/WhiteboardPage';
import GuestCanvasPage from './pages/GuestCanvasPage';
import LibrariesPage from './pages/LibrariesPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      {/* Public routes — no login required */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/canvas" element={<GuestCanvasPage />} />
      <Route path="/libraries" element={<LibrariesPage />} />

      {/* Protected routes — login required */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/board/:id"
        element={
          <ProtectedRoute>
            <WhiteboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}