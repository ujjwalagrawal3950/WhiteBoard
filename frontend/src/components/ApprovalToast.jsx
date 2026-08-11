import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

export default function ApprovalToast({ boardId }) {
  const socketRef = useSocket();
  const [requests, setRequests] = useState([]); // [{ boardId, guest, guestSocketId }]

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const onAccessRequested = (payload) => {
      setRequests(prev => {
        // Avoid duplicates
        if (prev.find(r => r.guest.id === payload.guest.id)) return prev;
        return [...prev, payload];
      });
    };

    socket.on('access-requested', onAccessRequested);
    return () => socket.off('access-requested', onAccessRequested);
  }, [socketRef]);

  const handleDecision = (request, status) => {
    const socket = socketRef?.current;
    if (!socket) return;

    socket.emit('grant-access', {
      boardId: request.boardId,
      guestId: request.guest.id,
      status,
      guestSocketId: request.guestSocketId,
    });

    setRequests(prev => prev.filter(r => r.guest.id !== request.guest.id));
  };

  if (requests.length === 0) return null;

  return (
    <div className="approval-toast-container" id="approval-toast-container">
      {requests.map((req) => (
        <div key={req.guest.id} className="approval-toast">
          <div className="approval-toast-header">
            <div className="approval-toast-icon">👋</div>
            <div className="approval-toast-info">
              <strong>{req.guest.name}</strong>
              <span>wants to join your board</span>
            </div>
          </div>
          <div className="approval-toast-actions">
            <button
              id={`accept-btn-${req.guest.id}`}
              className="approval-btn approval-btn-accept"
              onClick={() => handleDecision(req, 'APPROVED')}
            >
              ✓ Accept
            </button>
            <button
              id={`deny-btn-${req.guest.id}`}
              className="approval-btn approval-btn-deny"
              onClick={() => handleDecision(req, 'DENIED')}
            >
              ✕ Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
