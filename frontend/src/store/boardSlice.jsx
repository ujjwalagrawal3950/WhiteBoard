import { createSlice } from '@reduxjs/toolkit';

// ─── Element shape ──────────────────────────────────────────────────────────────
// { id, type, x1, y1, x2, y2, points[], text?, strokeColor, fillColor,
//   strokeWidth, lineStyle, opacity, groupId }

const MAX_HISTORY = 60;

function cloneElements(elements) {
  return elements.map(el => ({
    ...el,
    points: el.points ? el.points.map(p => ({ ...p })) : undefined,
  }));
}

function pushHistory(state) {
  const newHistory = state.history.slice(0, state.historyStep + 1);
  newHistory.push(cloneElements(state.elements));
  if (newHistory.length > MAX_HISTORY) newHistory.shift();
  state.history = newHistory;
  state.historyStep = newHistory.length - 1;
}

const boardSlice = createSlice({
  name: 'board',
  initialState: {
    elements: [],
    comments: [],
    history: [],
    historyStep: -1,

    // Tool
    tool: 'pencil',
    // 'pencil' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'diamond' | 'triangle' | 'text' | 'eraser' | 'selection' | 'image' | 'hand'

    // Selection
    selectedIds: [],   // array of element ids

    // Style
    strokeColor: '#ffffff',
    fillColor: 'transparent',
    strokeWidth: 2,
    lineStyle: 'solid',   // 'solid' | 'dashed' | 'dotted'
    opacity: 100,
    textAlign: 'left',    // 'left' | 'center' | 'right'
    fontFamily: 'Inter',  // font family for text elements
    fontSize: 20,         // font size for text elements

    // Camera (Pan & Zoom)
    camera: { x: 0, y: 0, zoom: 1 },
    showGrid: true,

    // Theme
    theme: 'dark', // 'light' | 'dark'
  },

  reducers: {
    // ─── Tool ────────────────────────────────────────────────────────────────────
    setTool(state, action) {
      state.tool = action.payload;
      if (action.payload !== 'selection') state.selectedIds = [];
    },

    // ─── Style ───────────────────────────────────────────────────────────────────
    setStrokeColor(state, action) { 
      state.strokeColor = action.payload; 
      state.elements.filter(e => state.selectedIds.includes(e.id)).forEach(e => e.strokeColor = action.payload);
    },
    setFillColor(state, action) { 
      state.fillColor = action.payload; 
      state.elements.filter(e => state.selectedIds.includes(e.id)).forEach(e => e.fillColor = action.payload);
    },
    setStrokeWidth(state, action) { 
      state.strokeWidth = action.payload; 
      state.elements.filter(e => state.selectedIds.includes(e.id)).forEach(e => e.strokeWidth = action.payload);
    },
    setLineStyle(state, action) { 
      state.lineStyle = action.payload; 
      state.elements.filter(e => state.selectedIds.includes(e.id)).forEach(e => e.lineStyle = action.payload);
    },
    setOpacity(state, action) { 
      state.opacity = action.payload; 
      state.elements.filter(e => state.selectedIds.includes(e.id)).forEach(e => e.opacity = action.payload);
    },
    setTextAlign(state, action) {
      state.textAlign = action.payload;
      state.elements.filter(e => state.selectedIds.includes(e.id)).forEach(e => e.textAlign = action.payload);
    },
    setFontFamily(state, action) {
      state.fontFamily = action.payload;
      state.elements.filter(e => state.selectedIds.includes(e.id) && e.type === 'text').forEach(e => e.fontFamily = action.payload);
    },
    setFontSize(state, action) {
      state.fontSize = action.payload;
      state.elements.filter(e => state.selectedIds.includes(e.id) && (e.type === 'text' || e.type === 'sticky')).forEach(e => e.fontSize = action.payload);
    },

    // ─── Camera & Grid ───────────────────────────────────────────────────────────
    setCamera(state, action) {
      state.camera = action.payload;
    },
    setZoom(state, action) {
      state.camera.zoom = action.payload;
    },
    toggleGrid(state) {
      state.showGrid = !state.showGrid;
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },

    // ─── Selection ───────────────────────────────────────────────────────────────
    setSelectedIds(state, action) {
      state.selectedIds = action.payload;
    },
    toggleSelectedId(state, action) {
      const id = action.payload;
      if (state.selectedIds.includes(id)) {
        state.selectedIds = state.selectedIds.filter(i => i !== id);
      } else {
        state.selectedIds.push(id);
      }
    },
    clearSelection(state) {
      state.selectedIds = [];
    },

    // ─── Elements ────────────────────────────────────────────────────────────────
    addElement(state, action) {
      state.elements.push(action.payload);
      pushHistory(state);
    },

    updateElement(state, action) {
      const idx = state.elements.findIndex(e => e.id === action.payload.id);
      if (idx !== -1) state.elements[idx] = action.payload;
    },

    finaliseElement(state, action) {
      const idx = state.elements.findIndex(e => e.id === action.payload.id);
      if (idx !== -1) state.elements[idx] = action.payload;
      pushHistory(state);
    },

    // Batch update (for moves, resizes)
    updateElements(state, action) {
      action.payload.forEach(el => {
        const idx = state.elements.findIndex(e => e.id === el.id);
        if (idx !== -1) state.elements[idx] = el;
      });
    },
    finaliseElements(state, action) {
      action.payload.forEach(el => {
        const idx = state.elements.findIndex(e => e.id === el.id);
        if (idx !== -1) state.elements[idx] = el;
      });
      pushHistory(state);
    },

    // Remote element sync
    updateRemoteElement(state, action) {
      const idx = state.elements.findIndex(e => e.id === action.payload.id);
      if (idx !== -1) {
        state.elements[idx] = action.payload;
      } else {
        state.elements.push(action.payload);
      }
    },
    deleteRemoteElements(state, action) {
      const idsToDelete = action.payload;
      state.elements = state.elements.filter(e => !idsToDelete.includes(e.id));
      state.selectedIds = state.selectedIds.filter(id => !idsToDelete.includes(id));
    },

    // Delete selected elements
    deleteSelected(state) {
      if (state.selectedIds.length === 0) return;
      state.elements = state.elements.filter(e => !state.selectedIds.includes(e.id));
      state.selectedIds = [];
      pushHistory(state);
    },

    // Duplicate selected elements
    duplicateSelected(state) {
      if (state.selectedIds.length === 0) return;
      const { v4: uuid } = { v4: () => Math.random().toString(36).slice(2) };
      const newEls = state.elements
        .filter(e => state.selectedIds.includes(e.id))
        .map(e => ({
          ...e,
          id: `${e.id}_dup_${Date.now()}`,
          x1: e.x1 + 20, y1: e.y1 + 20,
          x2: (e.x2 ?? e.x1) + 20, y2: (e.y2 ?? e.y1) + 20,
          points: e.points ? e.points.map(p => ({ x: p.x + 20, y: p.y + 20 })) : undefined,
          groupId: undefined,
        }));
      state.elements.push(...newEls);
      state.selectedIds = newEls.map(e => e.id);
      pushHistory(state);
    },

    // ─── Z-Index Controls ────────────────────────────────────────────────────────
    bringToFront(state) {
      if (state.selectedIds.length === 0) return;
      const selected = state.elements.filter(e => state.selectedIds.includes(e.id));
      const unselected = state.elements.filter(e => !state.selectedIds.includes(e.id));
      state.elements = [...unselected, ...selected];
      pushHistory(state);
    },
    sendToBack(state) {
      if (state.selectedIds.length === 0) return;
      const selected = state.elements.filter(e => state.selectedIds.includes(e.id));
      const unselected = state.elements.filter(e => !state.selectedIds.includes(e.id));
      state.elements = [...selected, ...unselected];
      pushHistory(state);
    },

    // Erase single element by id (or whole group if grouped)
    eraseElement(state, action) {
      const elToErase = state.elements.find(e => e.id === action.payload);
      if (!elToErase) return;
      if (elToErase.groupId) {
        state.elements = state.elements.filter(e => e.groupId !== elToErase.groupId);
      } else {
        state.elements = state.elements.filter(e => e.id !== action.payload);
      }
      pushHistory(state);
    },

    // Grouping
    groupSelected(state) {
      if (state.selectedIds.length < 2) return;
      const groupId = `g_${Date.now()}`;
      state.elements = state.elements.map(el =>
        state.selectedIds.includes(el.id) ? { ...el, groupId } : el
      );
      pushHistory(state);
    },
    ungroupSelected(state) {
      const targetGroupIds = new Set(
        state.elements
          .filter(el => state.selectedIds.includes(el.id) && el.groupId)
          .map(el => el.groupId)
      );
      state.elements = state.elements.map(el =>
        targetGroupIds.has(el.groupId) ? { ...el, groupId: undefined } : el
      );
      pushHistory(state);
    },

    // ─── History ─────────────────────────────────────────────────────────────────
    undo(state) {
      if (state.historyStep <= 0) {
        state.elements = [];
        state.selectedIds = [];
        state.historyStep = -1;
        return;
      }
      state.historyStep -= 1;
      state.elements = cloneElements(state.history[state.historyStep]);
      state.selectedIds = [];
    },
    redo(state) {
      if (state.historyStep >= state.history.length - 1) return;
      state.historyStep += 1;
      state.elements = cloneElements(state.history[state.historyStep]);
      state.selectedIds = [];
    },

    loadElements(state, action) {
      state.elements = action.payload ?? [];
      state.history = [cloneElements(state.elements)];
      state.historyStep = 0;
      state.selectedIds = [];
    },

    clearBoard(state) {
      state.elements = [];
      state.history = [[]];
      state.historyStep = 0;
      state.selectedIds = [];
    },

    // ─── Comments ─────────────────────────────────────────────────────────────────
    setComments(state, action) {
      state.comments = action.payload || [];
    },
    addComment(state, action) {
      // action.payload: { id, text, author, timestamp, elementIds }
      const existing = state.comments.findIndex(c => c.id === action.payload.id);
      if (existing !== -1) {
        state.comments[existing] = action.payload;
      } else {
        state.comments.push(action.payload);
      }
    },
    deleteComment(state, action) {
      state.comments = state.comments.filter(c => c.id !== action.payload);
    },
  },
});

export const {
  addElement, updateElement, finaliseElement,
  updateElements, finaliseElements,
  setTool, setStrokeColor, setFillColor, setStrokeWidth, setLineStyle, setOpacity, setTextAlign, setFontFamily, setFontSize,
  setSelectedIds, toggleSelectedId, clearSelection,
  loadElements,
  updateRemoteElement, deleteRemoteElements,
  deleteSelected, duplicateSelected, eraseElement,
  bringToFront, sendToBack,
  groupSelected, ungroupSelected,
  setCamera, setZoom, toggleGrid, toggleTheme,
  undo, redo, clearBoard,
  setComments, addComment, deleteComment
} = boardSlice.actions;

export default boardSlice.reducer;
