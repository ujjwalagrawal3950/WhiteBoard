import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchMyBoards, createBoard, deleteBoard } from '../store/dashboardSlice';
import { logoutUser } from '../store/authSlice';
import BoardCard from '../components/BoardCard';

export default function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { boards, status } = useSelector((state) => state.dashboard);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchMyBoards());
  }, [dispatch]);

  const handleCreateBoard = async () => {
    const result = await dispatch(createBoard());
    if (createBoard.fulfilled.match(result)) {
      navigate(`/board/${result.payload._id}`);
    }
  };

  const handleDelete = (boardId) => {
    dispatch(deleteBoard(boardId));
  };

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/', { replace: true });
  };

  return (
    <div className="dashboard-root">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <svg width="32" height="32" viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="12" fill="url(#dLogoGrad)" />
            <path d="M12 32 L22 12 L32 32" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M15.5 26 H28.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <defs>
              <linearGradient id="dLogoGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED"/><stop offset="1" stopColor="#4F46E5"/>
              </linearGradient>
            </defs>
          </svg>
          <span className="dashboard-brand-name">SketchSync</span>
        </div>

        <div className="dashboard-user">
          {user?.avatar && (
            <img src={user.avatar} alt={user.name} className="user-avatar" referrerPolicy="no-referrer" />
          )}
          <span className="user-name">{user?.name}</span>
          <button id="logout-btn" className="btn-ghost" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {/* Main content */}
      <main className="dashboard-main">
        <div className="dashboard-hero">
          <div>
            <h1 className="dashboard-title">My Boards</h1>
            <p className="dashboard-subtitle">Pick up where you left off or start something new.</p>
          </div>
          <button id="create-board-btn" className="btn-primary" onClick={handleCreateBoard}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Board
          </button>
        </div>

        {status === 'loading' && (
          <div className="boards-loading">
            {[1, 2, 3].map(i => <div key={i} className="board-card-skeleton" />)}
          </div>
        )}

        {status === 'succeeded' && boards.length === 0 && (
          <div className="boards-empty">
            <div className="empty-icon">🎨</div>
            <h3>No boards yet</h3>
            <p>Create your first board to start collaborating.</p>
            <button className="btn-primary" onClick={handleCreateBoard}>Create a Board</button>
          </div>
        )}

        {boards.length > 0 && (
          <div className="boards-grid">
            {boards.map(board => (
              <BoardCard
                key={board._id}
                board={board}
                onDelete={() => handleDelete(board._id)}
                onOpen={() => navigate(`/board/${board._id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
