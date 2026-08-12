import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, status } = useSelector((state) => state.auth);

  // Restore these lines now that auth is working
  if (status === 'loading' || status === 'idle') return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return children;
}
