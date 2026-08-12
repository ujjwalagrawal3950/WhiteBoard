import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import WhiteboardPage from './pages/WhiteboardPage';
import GuestCanvasPage from './pages/GuestCanvasPage';
import LibrariesPage from './pages/LibrariesPage';
import ProtectedRoute from './components/ProtectedRoute';
import { fetchCurrentUser } from './store/authSlice';

export default function App() {
  const dispatch = useDispatch();
  const { status } = useSelector((state) => state.auth);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchCurrentUser());
    }
  }, [status, dispatch]);

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