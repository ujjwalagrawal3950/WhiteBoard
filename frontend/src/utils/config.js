export const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  return 'https://whiteboard-backend-3wzu.onrender.com';
};
