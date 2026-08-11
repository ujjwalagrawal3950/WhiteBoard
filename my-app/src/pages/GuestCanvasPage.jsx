import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearBoard, loadElements } from '../store/boardSlice';
import { useSocket } from '../context/SocketContext';
import Toolbar from '../components/Toolbar';
import Canvas from '../components/Canvas';
import LoginModal from '../components/LoginModal';
import LibrarySidebar from '../components/LibrarySidebar';

const GUEST_STORAGE_KEY = 'sketchsync_guest_board_v2';

function useDebounce(callback, delay) {
  const timerRef = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
}

/**
 * GuestCanvasPage — fully functional whiteboard with no authentication required.
 * Work is auto-saved to localStorage on every change (debounced 1.5s).
 * On mount, restores from localStorage so closing the tab doesn't lose work.
 */
export default function GuestCanvasPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const socketRef = useSocket();
  const { user, isAuthenticated } = useSelector(s => s.auth);
  const { elements } = useSelector(s => s.board);

  // TEST: Generate or read a temporary room ID for guest collaboration
  const searchParams = new URLSearchParams(window.location.search);
  let roomId = searchParams.get('room');
  if (!roomId) {
    roomId = 'guest-' + Math.random().toString(36).substr(2, 9);
    window.history.replaceState(null, '', `?room=${roomId}`);
  }

  useEffect(() => {
    // Join the guest socket room for testing collaboration
    const socket = socketRef?.current;
    if (socket && roomId) {
      socket.emit('join-board', { boardId: roomId });
    }
  }, [socketRef, roomId]);

  const [loginModal, setLoginModal] = useState(null);
  const [saveIndicator, setSaveIndicator] = useState(''); // '' | 'saving' | 'saved'
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const isFirstLoad = useRef(true);

  // ─── Load from localStorage on first mount ──────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GUEST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          dispatch(loadElements(parsed));
        }
      }
    } catch (e) {
      // Corrupt data, ignore
    }
    // Clean up Redux board state on unmount
    return () => { dispatch(clearBoard()); };
  }, [dispatch]);

  // ─── Save to localStorage (debounced) ──────────────────────────────────────
  const doLocalSave = useCallback((els) => {
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(els));
      setSaveIndicator('saved');
      setTimeout(() => setSaveIndicator(''), 2000);
    } catch (e) {
      // Storage quota exceeded or private mode
    }
  }, []);

  const debouncedLocalSave = useDebounce(doLocalSave, 1500);

  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    setSaveIndicator('saving');
    debouncedLocalSave(elements);
  }, [elements, debouncedLocalSave]);

  // ─── Save immediately on tab close ─────────────────────────────────────────
  useEffect(() => {
    const onBeforeUnload = () => {
      try {
        // Synchronous save on unload
        const current = elements;
        if (current.length > 0) localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(current));
      } catch (_) {}
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [elements]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); dispatch({ type: 'board/undo' });
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); dispatch({ type: 'board/redo' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  // ─── Share handler ────────────────────────────────────────────────────────────
  const handleShare = () => {
    // TEST: auth gate bypassed — restore when done testing
    // if (!isAuthenticated) { setLoginModal('share'); } else { navigator.clipboard.writeText(window.location.href); }
    navigator.clipboard.writeText(window.location.href);
  };

  // ─── Download handler ─────────────────────────────────────────────────────────
  const handleDownload = () => {
    // TEST: auth gate bypassed — restore when done testing
    // if (!isAuthenticated) {
    //   setLoginModal('download');
    // } else {
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'sketchsync-board.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    // }
  };

  return (
    <div className="whiteboard-root">
      <Toolbar />

      <div className="wb-main">
        <div className="wb-topbar">
          <button id="wb-home-btn" className="btn-ghost wb-back" onClick={() => navigate('/')}>
            <svg width="22" height="22" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="10" fill="url(#tbLogoGrad)" />
              <path d="M12 32 L22 12 L32 32" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M15.5 26 H28.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <defs>
                <linearGradient id="tbLogoGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7C3AED"/><stop offset="1" stopColor="#4F46E5"/>
                </linearGradient>
              </defs>
            </svg>
          </button>
          
          <button className="btn-ghost" title="Library & Search" onClick={() => setIsLibraryOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>

          <h2 className="wb-title">SketchSync</h2>

          <div className="wb-topbar-right">
            {/* Local save indicator */}
            {saveIndicator === 'saving' && (
              <span className="save-indicator save-saving">⟳ Saving…</span>
            )}
            {saveIndicator === 'saved' && (
              <span className="save-indicator save-saved">✓ Saved locally</span>
            )}

            <button id="download-btn" className="btn-ghost" title={isAuthenticated ? 'Download as PNG' : 'Sign in to download'} onClick={handleDownload}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>

            <button id="share-btn" className="btn-ghost" title={isAuthenticated ? 'Copy share link' : 'Sign in to share'} onClick={handleShare}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>

            {isAuthenticated ? (
              <button id="go-dashboard-btn" className="btn-primary btn-sm" onClick={() => navigate('/dashboard')}>My Boards</button>
            ) : (
              <button id="topbar-signin-btn" className="btn-signin-pill" onClick={() => setLoginModal('share')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Sign in
              </button>
            )}

            {user?.avatar && (
              <img src={user.avatar} alt={user.name} className="user-avatar" referrerPolicy="no-referrer" />
            )}
          </div>
        </div>

        <Canvas boardId={roomId} />

        <LibrarySidebar isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />

        {loginModal && (
          <LoginModal trigger={loginModal} onClose={() => setLoginModal(null)} />
        )}
      </div>
    </div>
  );
}
