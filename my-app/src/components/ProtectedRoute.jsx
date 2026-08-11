import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, status } = useSelector((state) => state.auth);

  // TEST: Auth check temporarily bypassed — restore these lines when done testing
  // if (status === 'loading' || status === 'idle') return null;
  // if (!isAuthenticated) return <Navigate to="/" replace />;

  return children;
}
