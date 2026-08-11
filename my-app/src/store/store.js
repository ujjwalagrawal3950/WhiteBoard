import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/es/storage'; // ESM localStorage adapter
import authReducer from './authSlice';
import boardReducer from './boardSlice';
import dashboardReducer from './dashboardSlice';

// ─── Persist config for board slice ──────────────────────────────────────────
// Only persist the drawing elements + style settings. NOT history (too large) and NOT camera.
const boardPersistConfig = {
  key: 'sketchsync-board',
  storage,
  whitelist: [
    'elements',
    'strokeColor',
    'fillColor',
    'strokeWidth',
    'lineStyle',
    'opacity',
    'textAlign',
    'fontFamily',
  ],
};

const persistedBoardReducer = persistReducer(boardPersistConfig, boardReducer);

export const store = configureStore({
  reducer: {
    auth:      authReducer,
    board:     persistedBoardReducer,
    dashboard: dashboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist internal action types
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);