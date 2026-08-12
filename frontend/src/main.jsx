import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store/store';
import { SocketProvider } from './context/SocketContext';
import axios from 'axios';
import App from './App.jsx';
import './index.css';

import { getBackendUrl } from './utils/config';

axios.defaults.baseURL = getBackendUrl();
axios.defaults.withCredentials = true;

// ─── Extract token from URL (OAuth callback) ──────────────────────────────────
const params = new URLSearchParams(window.location.search);
const tokenFromUrl = params.get('token');
if (tokenFromUrl) {
  localStorage.setItem('whiteboard_token', tokenFromUrl);
  // Remove token from URL
  window.history.replaceState({}, document.title, window.location.pathname);
}

// ─── Setup Axios Interceptor ──────────────────────────────────────────────────
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('whiteboard_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      {/* PersistGate delays rendering until persisted state is rehydrated */}
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <SocketProvider>
            <App />
          </SocketProvider>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </StrictMode>
);
