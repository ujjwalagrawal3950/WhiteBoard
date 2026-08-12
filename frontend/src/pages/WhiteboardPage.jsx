import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { loadElements, clearBoard, addComment, deleteComment } from '../store/boardSlice';
import { useSocket } from '../context/SocketContext';
import Toolbar from '../components/Toolbar';
import Canvas from '../components/Canvas';
import WaitingRoom from '../components/WaitingRoom';
import ApprovalToast from '../components/ApprovalToast';
import LoginModal from '../components/LoginModal';
import LibrarySidebar from '../components/LibrarySidebar';
import TaskPanel from '../components/TaskPanel';

// ─── Save indicator states ────────────────────────────────────────────────────
const SAVE_STATES = { idle: 'idle', unsaved: 'unsaved', saving: 'saving', saved: 'saved' };

// ─── Debounce utility ─────────────────────────────────────────────────────────
function useDebounce(callback, delay) {
  const timerRef = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
}

export default function WhiteboardPage() {
  const { id: boardId } = useParams();
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const socketRef  = useSocket();

  const { elements, comments } = useSelector(s => s.board);
  const { user }     = useSelector(s => s.auth);

  // Board meta
  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [ownerName, setOwnerName]   = useState('');
  const isOwnerRef = useRef(false);

  // Access control state
  const [accessState, setAccessState] = useState('loading'); // 'loading' | 'granted' | 'pending' | 'denied'

  // Save indicator
  const [saveState, setSaveState] = useState(SAVE_STATES.idle);
  const isFirstLoad = useRef(true);

  // Login modal (triggered by Share / Download for guests)
  const [loginModal, setLoginModal] = useState(null); // null | 'share' | 'download'
  
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);

  // Share dropdown state
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);
  const [copyState, setCopyState] = useState('idle'); // 'idle' | 'copied'
  const shareDropdownRef = useRef(null);

  // Owner state
  const [isOwner, setIsOwner] = useState(false);

  // localStorage key for this board (backup layer)
  const localKey = `sketchsync_board_${boardId}`;

  // ─── Load board ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadBoard() {
      // Optimistically load local cache first for instant display
      try {
        const cached = localStorage.getItem(localKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) dispatch(loadElements(parsed));
        }
      } catch (_) {}

      try {
        const { data } = await axios.get(`/api/boards/${boardId}`, { withCredentials: true });
        dispatch(loadElements(data.elements));
        dispatch({ type: 'board/setComments', payload: data.comments || [] });
        // Sync cache with server data
        try { localStorage.setItem(localKey, JSON.stringify(data.elements)); } catch (_) {}
        setBoardTitle(data.title);
        // Bulletproof string comparison — both sides must be strings
        const ownerIdStr = String(data.ownerId ?? '');
        const userIdStr  = String(user?.id ?? '');
        const ownerMatch = ownerIdStr.length > 0 && userIdStr.length > 0 && ownerIdStr === userIdStr;
        isOwnerRef.current = ownerMatch;
        setIsOwner(ownerMatch);
        setAccessState('granted');

        // Join socket room
        const socket = socketRef?.current;
        if (socket) socket.emit('join-board', { boardId });
      } catch (err) {
        if (err.response?.status === 403) {
          setAccessState('pending');
          if (err.response.data?.ownerName) setOwnerName(err.response.data.ownerName);
        } else {
          navigate('/dashboard');
        }
      }
    }

    // TEST: user check temporarily bypassed — restore when done testing
    // if (user) {
    //   loadBoard();
    // } else {
    //   navigate('/', { replace: true });
    // }
    loadBoard(); // call unconditionally for testing
    return () => { dispatch(clearBoard()); };
  }, [boardId, user, dispatch, navigate, socketRef, localKey]);

  // ─── Auto-save (debounced, Phase 6) ─────────────────────────────────────────
  const doSave = useCallback(async (els, comms) => {
    setSaveState(SAVE_STATES.saving);
    try {
      await axios.patch(`/api/boards/${boardId}/save`, { elements: els, comments: comms }, { withCredentials: true });
      // Also update local cache after successful server save
      try { localStorage.setItem(localKey, JSON.stringify(els)); } catch (_) {}
      setSaveState(SAVE_STATES.saved);
      setTimeout(() => setSaveState(SAVE_STATES.idle), 3000);
    } catch {
      setSaveState(SAVE_STATES.unsaved);
    }
  }, [boardId, localKey]);

  const debouncedSave = useDebounce(doSave, 2000);

  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (accessState !== 'granted') return;
    setSaveState(SAVE_STATES.unsaved);
    debouncedSave(elements, comments);
  }, [elements, comments, accessState, debouncedSave]);

  // ─── Sync Comments via Socket ────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket || accessState !== 'granted') return;

    const onCommentUpdate = (comment) => dispatch(addComment(comment));
    const onCommentDelete = ({ commentId }) => dispatch(deleteComment(commentId));

    socket.on('comment-update', onCommentUpdate);
    socket.on('comment-delete', onCommentDelete);

    return () => {
      socket.off('comment-update', onCommentUpdate);
      socket.off('comment-delete', onCommentDelete);
    };
  }, [socketRef, accessState, dispatch]);

  // ─── Save to localStorage on tab close (backup) ──────────────────────────────
  useEffect(() => {
    const onBeforeUnload = () => {
      try { if (elements.length > 0) localStorage.setItem(localKey, JSON.stringify(elements)); } catch (_) {}
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [elements, localKey]);

  // ─── Theme Sync ──────────────────────────────────────────────────────────────
  const { theme } = useSelector(s => s.board);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'board/undo' });
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        dispatch({ type: 'board/redo' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  // ─── Close share dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(e.target)) {
        setShareDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Copy link handler ───────────────────────────────────────────────────────
  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopyState('copied');
    setTimeout(() => {
      setCopyState('idle');
      setShareDropdownOpen(false);
    }, 1800);
  }, []);

  // ─── Access granted callback (from WaitingRoom) ──────────────────────────────
  const handleAccessGranted = useCallback(({ boardElements, boardTitle: title, comments }) => {
    dispatch(loadElements(boardElements));
    dispatch({ type: 'board/setComments', payload: comments || [] });
    if (title) setBoardTitle(title);
    setAccessState('granted');
    const socket = socketRef?.current;
    if (socket) socket.emit('join-board', { boardId });
  }, [dispatch, socketRef, boardId]);

  const handleAccessDenied = useCallback(() => {
    setAccessState('denied');
  }, []);

  // ─── Save indicator label ────────────────────────────────────────────────────
  const saveLabel = {
    [SAVE_STATES.idle]:    '',
    [SAVE_STATES.unsaved]: '✎ Unsaved changes',
    [SAVE_STATES.saving]:  '⟳ Saving...',
    [SAVE_STATES.saved]:   '✓ Saved to cloud',
  }[saveState];

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (accessState === 'loading') {
    return (
      <div className="wb-loading">
        <div className="wb-loading-spinner" />
        <span>Loading board…</span>
      </div>
    );
  }

  if (accessState === 'pending') {
    return (
      <WaitingRoom
        boardId={boardId}
        ownerName={ownerName}
        onAccessGranted={handleAccessGranted}
        onAccessDenied={handleAccessDenied}
      />
    );
  }

  return (
    <div className="whiteboard-root">
      {/* Toolbar sidebar */}
      <Toolbar />

      {/* Top bar — sits above canvas area */}
      <div className="wb-main">
        <div className="wb-topbar">
        <button id="wb-back-btn" className="btn-ghost wb-back" onClick={() => navigate('/dashboard')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <button className="btn-ghost" title="Library & Search" onClick={() => setIsLibraryOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>

        <h2 className="wb-title">{boardTitle}</h2>

        <div className="wb-topbar-right">
          {/* Save indicator */}
          {saveLabel && (
            <span className={`save-indicator save-${saveState}`}>{saveLabel}</span>
          )}

          {/* Download button */}
          <button
            id="download-btn"
            className="btn-ghost"
            title="Download as PNG"
            onClick={() => {
              if (!user) { setLoginModal('download'); return; }
              const canvas = document.getElementById('main-canvas');
              if (!canvas) return;
              const link = document.createElement('a');
              link.download = `${boardTitle}.png`;
              link.href = canvas.toDataURL('image/png');
              link.click();
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>

          {/* Task panel button */}
          <button
            id="task-panel-btn"
            className={`btn-ghost ${isTaskPanelOpen ? 'btn-ghost-active' : ''}`}
            title="Tasks"
            onClick={() => setIsTaskPanelOpen(o => !o)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="5" width="6" height="6" rx="1"/>
              <path d="M3 17h6"/><path d="M12 7h9"/><path d="M12 12h9"/><path d="M12 17h9"/>
              <polyline points="7 8 8 9 10 7"/>
            </svg>
            Tasks
          </button>

          {/* Share dropdown */}
          <div className="share-dropdown-wrapper" ref={shareDropdownRef}>
            <button
              id="share-link-btn"
              className={`btn-ghost ${shareDropdownOpen ? 'btn-ghost-active' : ''}`}
              title={user ? 'Share board' : 'Sign in to share'}
              onClick={() => {
                if (!user) { setLoginModal('share'); return; }
                setShareDropdownOpen(o => !o);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>

            {shareDropdownOpen && (
              <div className="share-dropdown">
                <div className="share-dropdown-header">Share this board</div>
                <div className="share-dropdown-url">{window.location.href}</div>
                <button
                  id="copy-link-btn"
                  className={`share-copy-btn ${copyState === 'copied' ? 'share-copy-btn-copied' : ''}`}
                  onClick={handleCopyLink}
                >
                  {copyState === 'copied' ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* User avatar */}
          {user?.avatar && (
            <img src={user.avatar} alt={user.name} className="user-avatar" referrerPolicy="no-referrer" />
          )}
        </div>
      </div>

        {/* Canvas */}
        <Canvas boardId={boardId} />

        {/* Library Sidebar */}
        <LibrarySidebar isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />

        {/* Task panel */}
        <TaskPanel isOpen={isTaskPanelOpen} onClose={() => setIsTaskPanelOpen(false)} boardId={boardId} />

        {/* Host approval toasts (visible only to owner) */}
        {isOwner && <ApprovalToast boardId={boardId} />}

        {/* Login modal — triggered by Share / Download for guests */}
        {loginModal && (
          <LoginModal
            trigger={loginModal}
            onClose={() => setLoginModal(null)}
          />
        )}
      </div>
    </div>
  );
}
