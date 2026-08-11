import { useEffect } from 'react';

/**
 * LoginModal — appears when a guest tries to Share or Download.
 * Prompts Google sign-in without blocking the drawing experience.
 *
 * Props:
 *   trigger: 'share' | 'download' | null  — what caused it to open
 *   onClose: () => void
 */
export default function LoginModal({ trigger, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleGoogleLogin = () => {
    // After OAuth, Google redirects back to the server which sets the cookie
    // then redirects to /dashboard. We store the current board URL so we can
    // redirect back after login.
    sessionStorage.setItem('redirect_after_login', window.location.pathname);
    const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  const featureLabel = trigger === 'download' ? 'download your board' : 'share this board';
  const featureIcon  = trigger === 'download' ? '⬇️' : '🔗';

  return (
    /* Backdrop */
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>

        {/* Close button */}
        <button id="modal-close-btn" className="modal-close-btn" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Icon */}
        <div className="modal-icon">{featureIcon}</div>

        {/* Heading */}
        <h2 className="modal-title">Sign in to {featureLabel}</h2>
        <p className="modal-desc">
          Your drawing is safe right here. Sign in with Google to unlock saving, sharing, and collaboration features — it only takes a second.
        </p>

        {/* Benefits list */}
        <ul className="modal-benefits">
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Share a link — anyone with it can view or join
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Save your board to the cloud automatically
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Download as PNG / SVG
          </li>
        </ul>

        {/* Google button */}
        <button
          id="modal-google-btn"
          className="google-btn"
          onClick={handleGoogleLogin}
        >
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <button className="modal-skip-btn" onClick={onClose}>
          Continue drawing without signing in
        </button>
      </div>
    </div>
  );
}
