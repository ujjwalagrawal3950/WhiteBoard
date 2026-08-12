import { createContext, useContext, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    // TEST: socket connection auth check temporarily bypassed
    if (!socketRef.current) {
      const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');
      socketRef.current = io(backendUrl, {
        withCredentials: true,
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socketRef.current.on('connect', () => {
        console.log('🔌 Socket connected:', socketRef.current.id);
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });
    }

    return () => {
      // TEST: socket cleanup auth check bypassed
      // if (!isAuthenticated && socketRef.current) {
      //   socketRef.current.disconnect();
      //   socketRef.current = null;
      // }
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={socketRef}>
      {children}
    </SocketContext.Provider>
  );
}

// Returns the ref — call socketRef.current to get the socket instance
export function useSocket() {
  return useContext(SocketContext);
}
