import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchCurrentUser } from '../store/authSlice';
import { getBackendUrl } from '../utils/config';

export default function LandingPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);

  // Silently check if user is already logged in
  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  // If already logged in, go straight to dashboard
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleStartDrawing = () => {
    // Guest mode — drop into a fresh local canvas (no board ID needed)
    navigate('/canvas');
  };

  const handleGoogleLogin = () => {
    const backendUrl = getBackendUrl();
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  return (
    <div className="landing-root">
      {/* Animated background blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="landing-card">
        {/* Logo mark */}
        <div className="landing-logo">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="12" fill="url(#logoGrad)" />
            <path d="M12 32 L22 12 L32 32" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M15.5 26 H28.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED"/>
                <stop offset="1" stopColor="#4F46E5"/>
              </linearGradient>
            </defs>
          </svg>
          <span className="landing-logo-text">SketchSync</span>
        </div>

        <h1 className="landing-headline">
          Collaborate on ideas,<br />
          <span className="gradient-text">in real time.</span>
        </h1>

        <p className="landing-sub">
          Draw, annotate, and brainstorm — no account required to start.
          Sign in only when you want to save or share.
        </p>

        <div className="landing-features">
          <div className="feature-chip">✏️ Draw instantly</div>
          <div className="feature-chip">⚡ Real-time sync</div>
          <div className="feature-chip">☁️ Save with Google</div>
        </div>

        {/* Primary CTA — no login required */}
        <button
          id="start-drawing-btn"
          className="btn-start-drawing"
          onClick={handleStartDrawing}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
          Start Drawing — No Login Needed
        </button>

        {/* Divider */}
        <div className="landing-divider">
          <span>or</span>
        </div>

        {/* Secondary CTA — sign in to save & share */}
        <button
          id="google-login-btn"
          className="google-btn google-btn-secondary"
          onClick={handleGoogleLogin}
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google to Save &amp; Share
        </button>

        <p className="landing-footer">
          By using SketchSync, you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
