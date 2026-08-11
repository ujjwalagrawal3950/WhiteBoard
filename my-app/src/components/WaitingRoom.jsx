import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSocket } from '../context/SocketContext';

export default function WaitingRoom({ boardId, ownerName, onAccessGranted, onAccessDenied }) {
  const { user } = useSelector(s => s.auth);
  const socketRef = useSocket();
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket || !user) return;

    // Emit request-access on mount
    socket.emit('request-access', {
      boardId,
      guest: { id: user.id, name: user.name, avatar: user.avatar },
    });

    const onGranted = (data) => onAccessGranted(data);
    const onDenied  = ()     => { setDenied(true); onAccessDenied(); };

    socket.on('access-granted', onGranted);
    socket.on('access-denied',  onDenied);

    return () => {
      socket.off('access-granted', onGranted);
      socket.off('access-denied',  onDenied);
    };
  }, [socketRef, boardId, user, onAccessGranted, onAccessDenied]);

  return (
    <div className="waiting-room-overlay">
      <div className="waiting-room-card">
        {denied ? (
          <>
            <div className="waiting-icon denied-icon">✕</div>
            <h2>Access Denied</h2>
            <p>The board owner has declined your request.</p>
            <button className="btn-primary" onClick={() => window.history.back()}>Go Back</button>
          </>
        ) : (
          <>
            <div className="waiting-spinner">
              <div className="spinner-ring" />
              <div className="spinner-ring delay-1" />
              <div className="spinner-ring delay-2" />
            </div>
            <h2>Requesting Access</h2>
            <p>
              Waiting for <strong>{ownerName || 'the board owner'}</strong> to let you in…
            </p>
            <div className="waiting-user-info">
              {user?.avatar && (
                <img src={user.avatar} alt={user.name} className="user-avatar-sm" referrerPolicy="no-referrer" />
              )}
              <span>{user?.name}</span>
              <span className="waiting-badge">Pending</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
