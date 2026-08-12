import { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuid } from 'uuid';
import {
  addElement, updateElement, finaliseElement,
  updateElements, finaliseElements,
  eraseElement, updateRemoteElement,
  setSelectedIds, toggleSelectedId, clearSelection,
  deleteSelected, duplicateSelected, bringToFront, sendToBack, setCamera, setZoom,
} from '../store/boardSlice';
import { useSocket } from '../context/SocketContext';

// ══════════════════════════════════════════════════════════════════
// DRAWING HELPERS
// ══════════════════════════════════════════════════════════════════

import { drawElement, getBoundingBox } from '../utils/drawing';

// ══════════════════════════════════════════════════════════════════
// HIT TESTING
// ══════════════════════════════════════════════════════════════════

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isPointInElement(el, px, py) {
  const T = Math.max(8, (el.strokeWidth || 2) * 2);
  const minX = Math.min(el.x1, el.x2 ?? el.x1), maxX = Math.max(el.x1, el.x2 ?? el.x1);
  const minY = Math.min(el.y1, el.y2 ?? el.y1), maxY = Math.max(el.y1, el.y2 ?? el.y1);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const hasFill = el.fillColor && el.fillColor !== 'transparent';

  switch (el.type) {
    case 'rectangle':
      if (hasFill) return px >= minX && px <= maxX && py >= minY && py <= maxY;
      return (
        (px >= minX - T && px <= maxX + T && py >= minY - T && py <= minY + T) ||
        (px >= minX - T && px <= maxX + T && py >= maxY - T && py <= maxY + T) ||
        (px >= minX - T && px <= minX + T && py >= minY && py <= maxY) ||
        (px >= maxX - T && px <= maxX + T && py >= minY && py <= maxY)
      );
    case 'ellipse': {
      const rx = (maxX - minX) / 2 || 1, ry = (maxY - minY) / 2 || 1;
      const norm = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
      return hasFill ? norm <= 1 : Math.abs(norm - 1) < 0.3;
    }
    case 'diamond': {
      const normX = Math.abs(px - cx) / ((maxX - minX) / 2 || 1);
      const normY = Math.abs(py - cy) / ((maxY - minY) / 2 || 1);
      return hasFill ? normX + normY <= 1 : Math.abs(normX + normY - 1) < 0.2;
    }
    case 'triangle': {
      // Point in triangle test
      const ax = cx, ay = minY, bx = maxX, by = maxY, bX = minX;
      const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
      const d2 = (px - bX) * (by - maxY) - (bx - bX) * (py - maxY);
      const d3 = (px - ax) * (maxY - ay) - (cx - ax) * (py - ay);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      return hasFill ? !(hasNeg && hasPos) : distToSegment(px, py, cx, minY, maxX, maxY) < T || distToSegment(px, py, maxX, maxY, minX, maxY) < T || distToSegment(px, py, minX, maxY, cx, minY) < T;
    }
    case 'line':
    case 'arrow':
      return distToSegment(px, py, el.x1, el.y1, el.x2 ?? el.x1, el.y2 ?? el.y1) < T;
    case 'pencil':
      if (!el.points || el.points.length < 2) return false;
      for (let i = 1; i < el.points.length; i++) {
        if (distToSegment(px, py, el.points[i-1].x, el.points[i-1].y, el.points[i].x, el.points[i].y) < T) return true;
      }
      return false;
    case 'text':
      const minTxtX = Math.min(el.x1, el.x2 ?? el.x1 + 200);
      const minTxtY = Math.min(el.y1, el.y2 ?? el.y1 + 40);
      const maxTxtX = Math.max(el.x1, el.x2 ?? el.x1 + 200);
      const maxTxtY = Math.max(el.y1, el.y2 ?? el.y1 + 40);
      return px >= minTxtX - T && py >= minTxtY - T && px <= maxTxtX + T && py <= maxTxtY + T;
    default:
      return px >= minX - T && px <= maxX + T && py >= minY - T && py <= maxY + T;
  }
}

function getElementsInRect(elements, rb) {
  const minX = Math.min(rb.x1, rb.x2);
  const maxX = Math.max(rb.x1, rb.x2);
  const minY = Math.min(rb.y1, rb.y2);
  const maxY = Math.max(rb.y1, rb.y2);
  return elements.filter(el => {
    const elMinX = Math.min(el.x1, el.x2 ?? el.x1);
    const elMaxX = Math.max(el.x1, el.x2 ?? el.x1);
    const elMinY = Math.min(el.y1, el.y2 ?? el.y1);
    const elMaxY = Math.max(el.y1, el.y2 ?? el.y1);
    return elMinX >= minX && elMaxX <= maxX && elMinY >= minY && elMaxY <= maxY;
  });
}


// getBoundingBox is now imported from utils/drawing.js

const HANDLES = ['nw','n','ne','e','se','s','sw','w'];
function getHandlePos(bb) {
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
  return {
    nw: { x: bb.minX, y: bb.minY }, n: { x: cx, y: bb.minY }, ne: { x: bb.maxX, y: bb.minY },
    e:  { x: bb.maxX, y: cy },
    se: { x: bb.maxX, y: bb.maxY }, s: { x: cx, y: bb.maxY }, sw: { x: bb.minX, y: bb.maxY },
    w:  { x: bb.minX, y: cy },
  };
}

function getHandleAtPos(bb, px, py, threshold = 10) {
  const poses = getHandlePos(bb);
  for (const h of HANDLES) {
    if (Math.abs(px - poses[h].x) <= threshold && Math.abs(py - poses[h].y) <= threshold) return h;
  }
  return null;
}

function applyResize(el, handle, dx, dy) {
  const e = { ...el, points: el.points ? el.points.map(p => ({ ...p })) : undefined };
  switch (handle) {
    case 'se': e.x2 = (e.x2 ?? e.x1) + dx; e.y2 = (e.y2 ?? e.y1) + dy; break;
    case 'sw': e.x1 += dx; e.y2 = (e.y2 ?? e.y1) + dy; break;
    case 'ne': e.x2 = (e.x2 ?? e.x1) + dx; e.y1 += dy; break;
    case 'nw': e.x1 += dx; e.y1 += dy; break;
    case 'n':  e.y1 += dy; break;
    case 's':  e.y2 = (e.y2 ?? e.y1) + dy; break;
    case 'e':  e.x2 = (e.x2 ?? e.x1) + dx; break;
    case 'w':  e.x1 += dx; break;
  }
  return e;
}

// Throttle
function throttle(fn, delay) {
  let last = 0;
  return (...args) => { const now = Date.now(); if (now - last >= delay) { last = now; fn(...args); } };
}

// ══════════════════════════════════════════════════════════════════
// CANVAS COMPONENT
// ══════════════════════════════════════════════════════════════════

export default function Canvas({ boardId }) {
  const canvasRef  = useRef(null);
  const dispatch   = useDispatch();
  const socketRef  = useSocket();

  const { elements, tool, selectedIds, strokeColor, fillColor, strokeWidth, lineStyle, opacity, camera, showGrid, textAlign, fontFamily, fontSize, theme } =
    useSelector(s => s.board);
  const { user } = useSelector(s => s.auth);


  // Stable refs for event handlers (avoid stale closure)
  const stateRef = useRef({});
  stateRef.current = { elements, tool, selectedIds, strokeColor, fillColor, strokeWidth, lineStyle, opacity, camera, textAlign, fontFamily, fontSize, theme };

  // Interaction refs
  const interRef = useRef({
    action: 'none',      // 'drawing'|'moving'|'resizing'|'rubber-band'|'panning'
    drawingEl: null,
    moveStart: null,     // { x, y, snapshot: [...elements] }
    resizeHandle: null,
    rubberBand: null,    // { x1, y1, x2, y2 }
    panStart: null,      // { x, y } (screen coordinates)
  });

  // Local UI state
  const [textEditing, setTextEditing]   = useState(null); // { id, x, y }
  const [rubberBand, setRubberBand]     = useState(null);
  const [activePan, setActivePan]       = useState(null); // { dx, dy } for performance
  const [remoteCursors, setRemoteCursors] = useState({});
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const hasSelection = selectedIds.length > 0;
  const selectionBB = (hasSelection && !textEditing) ? getBoundingBox(elements, selectedIds) : null;

  // Premium Eraser Animation Refs
  const eraserTrailRef = useRef(null);
  const eraserCursorRef = useRef(null);
  const mousePosRef = useRef({ x: -1000, y: -1000 });
  const trailPosRef = useRef({ x: -1000, y: -1000 });
  
  const textInputRef = useRef(null);

  // ─── Canvas resize observer ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      // Trigger a re-render when container resizes
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas.parentElement || canvas);
    return () => ro.disconnect();
  }, []);

  // ─── Premium Eraser Animation Loop ───────────────────────────────
  useEffect(() => {
    let animationFrameId;

    const renderLoop = () => {
      if (eraserCursorRef.current && eraserTrailRef.current) {
        const mouse = mousePosRef.current;
        const trail = trailPosRef.current;

        if (trail.x === -1000 && trail.y === -1000 && mouse.x !== -1000) {
          trail.x = mouse.x;
          trail.y = mouse.y;
        }

        // Spring physics interpolation (lower speed = more lag = longer stretch)
        const speed = 0.15; // Decreased from 0.35 to increase stretching capacity
        if (mouse.x !== -1000) {
          trail.x += (mouse.x - trail.x) * speed;
          trail.y += (mouse.y - trail.y) * speed;
        }

        const dx = mouse.x - trail.x;
        const dy = mouse.y - trail.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const size = 16;
        const halfSize = size / 2;
        const isVisible = mouse.x !== -1000;

        // Update hollow circle (front)
        eraserCursorRef.current.style.left = `${mouse.x}px`;
        eraserCursorRef.current.style.top = `${mouse.y}px`;
        eraserCursorRef.current.style.opacity = isVisible ? '1' : '0';

        // Update stretched shadow (trail)
        eraserTrailRef.current.style.left = `${trail.x}px`;
        eraserTrailRef.current.style.top = `${trail.y}px`;
        eraserTrailRef.current.style.width = `${Math.max(size, distance + size)}px`;
        eraserTrailRef.current.style.transform = `translate(-${halfSize}px, -${halfSize}px) rotate(${angle}rad)`;
        eraserTrailRef.current.style.opacity = isVisible ? '1' : '0';
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // ─── Rendering loop ──────────────────────────────────────────────
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W; canvas.height = H;

    // Background
    ctx.fillStyle = theme === 'light' ? '#f8fafc' : '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Apply Camera Transform
    const camX = camera.x + (activePan?.dx || 0);
    const camY = camera.y + (activePan?.dy || 0);

    // Dot grid (panned & scaled)
    if (showGrid) {
      ctx.fillStyle = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'; // More visible grey
      const gap = 28 * camera.zoom;
      const offsetX = camX % gap;
      const offsetY = camY % gap;
      for (let x = offsetX; x < W; x += gap) {
        for (let y = offsetY; y < H; y += gap) {
          ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    ctx.save();
    ctx.translate(camX, camY);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw all elements
    elements.forEach(el => {
      drawElement(ctx, el, selectedIds.includes(el.id), theme, textEditing?.id === el.id);
    });

    // Selection bounding box + resize handles
    if (selectedIds.length > 0 && !textEditing) {
      const bb = getBoundingBox(elements, selectedIds);
      if (bb) {
        const PAD = 10;
        const bx = bb.minX - PAD, by = bb.minY - PAD;
        const bw = bb.maxX - bb.minX + PAD * 2;
        const bh = bb.maxY - bb.minY + PAD * 2;

        ctx.save();
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 3 / camera.zoom]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();

        // Resize handles (only for single selection)
        if (selectedIds.length === 1) {
          const paddedBb = { minX: bx, minY: by, maxX: bx + bw, maxY: by + bh };
          const poses = getHandlePos(paddedBb);
          HANDLES.forEach(h => {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#818cf8';
            ctx.lineWidth = 1.5 / camera.zoom;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(poses[h].x, poses[h].y, 5 / camera.zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          });
        }

        // Group indicator badge
        const hasGroup = elements.some(e => selectedIds.includes(e.id) && e.groupId);
        if (hasGroup) {
          ctx.save();
          ctx.fillStyle = '#7C3AED';
          ctx.roundRect(bx, by - 24 / camera.zoom, 52 / camera.zoom, 18 / camera.zoom, 4 / camera.zoom);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = `${11 / camera.zoom}px Inter, sans-serif`;
          ctx.fillText('GROUP', bx + 6 / camera.zoom, by - 8 / camera.zoom);
          ctx.restore();
        }
      }
    }

    // Rubber-band selection rect
    if (rubberBand) {
      ctx.save();
      ctx.fillStyle = theme === 'light' ? 'rgba(79,70,229,0.1)' : 'rgba(129,140,248,0.15)';
      ctx.strokeStyle = theme === 'light' ? 'rgba(79,70,229,0.5)' : 'rgba(129,140,248,0.8)';
      ctx.lineWidth = 1 / camera.zoom;
      ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]);
      const rx = Math.min(rubberBand.x1, rubberBand.x2);
      const ry = Math.min(rubberBand.y1, rubberBand.y2);
      const rw = Math.abs(rubberBand.x2 - rubberBand.x1);
      const rh = Math.abs(rubberBand.y2 - rubberBand.y1);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }

    ctx.restore(); // Restore camera transform

  }, [elements, selectedIds, rubberBand, camera, activePan, showGrid]);

  // ─── Zoom/Pan Wheel Handling ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const { camera } = stateRef.current;
      
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomStep = 0.02;
        const zoomDelta = e.deltaY > 0 ? -zoomStep : zoomStep;
        let newZoom = Math.min(Math.max(0.1, camera.zoom + zoomDelta), 5);
        
        // Zoom relative to cursor
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const newX = mouseX - (mouseX - camera.x) * (newZoom / camera.zoom);
        const newY = mouseY - (mouseY - camera.y) * (newZoom / camera.zoom);
        
        dispatch(setCamera({ x: newX, y: newY, zoom: newZoom }));
      } else {
        // Pan
        dispatch(setCamera({
          x: camera.x - e.deltaX,
          y: camera.y - e.deltaY,
          zoom: camera.zoom
        }));
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  // ─── Socket effects ──────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    const onEl = (el) => dispatch(updateRemoteElement(el));
    const onCursor = ({ userId: uid, x, y, userName: uName, userAvatar: uAvatar }) =>
      setRemoteCursors(prev => ({ ...prev, [uid]: { x, y, name: uName, avatar: uAvatar } }));
    socket.on('element-update', onEl);
    socket.on('cursor-moved', onCursor);
    return () => { socket.off('element-update', onEl); socket.off('cursor-moved', onCursor); };
  }, [socketRef, dispatch]);

  // ─── Throttled emitters ──────────────────────────────────────────
  const emitEl = useCallback(throttle((el) => {
    const s = socketRef?.current;
    if (s && boardId) s.emit('element-update', { boardId, element: el });
  }, 30), [socketRef, boardId]);

  const emitCursor = useCallback(throttle((x, y) => {
    const s = socketRef?.current;
    if (s && boardId && user) s.emit('cursor-move', { boardId, x, y, userName: user.name, userId: user.id, userAvatar: user.avatar });
  }, 50), [socketRef, boardId, user]);

  // ─── Text commit ─────────────────────────────────────────────────
  const commitText = useCallback((id, textValue, textWidth, textHeight) => {
    const { elements: els, camera } = stateRef.current;
    const el = els.find(e => e.id === id);
    if (!el) return;
    if (!textValue.trim()) {
      // Remove empty text element
      dispatch({ type: 'board/eraseElement', payload: id });
    } else {
      const updated = { 
        ...el, 
        text: textValue,
        ...(textWidth ? { x2: el.x1 + textWidth / camera.zoom } : {}),
        ...(textHeight ? { y2: el.y1 + textHeight / camera.zoom } : {})
      };
      dispatch({ type: 'board/finaliseElement', payload: updated });
      dispatch({ type: 'board/setSelectedIds', payload: [id] });
      dispatch({ type: 'board/setTool', payload: 'selection' });
      emitEl(updated);
    }
    setTextEditing(null);
  }, [dispatch, emitEl]);

  // ─── Pointer helpers ─────────────────────────────────────────────
  const getScreenPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getPos = (e) => {
    const screen = getScreenPos(e);
    const { camera } = stateRef.current;
    return { 
      x: (screen.x - camera.x) / camera.zoom, 
      y: (screen.y - camera.y) / camera.zoom 
    };
  };

  // ─── Keyboard: Delete selected & Spacebar Pan ──────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !textEditing) {
        dispatch(deleteSelected());
      }
      if (e.code === 'Space' && !textEditing) {
        setIsSpacePressed(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [dispatch, textEditing]);

  // ─── Pointer Down ────────────────────────────────────────────────
  const onPointerDown = (e) => {
    const screenPos = getScreenPos(e);
    const { x, y } = getPos(e);
    const { tool: t, elements: els, selectedIds: selIds,
            strokeColor: sc, fillColor: fc, strokeWidth: sw, lineStyle: ls, opacity: op, camera } = stateRef.current;
    canvasRef.current.setPointerCapture(e.pointerId);

    // ── Panning ──
    if (e.button === 1 || isSpacePressed) {
      interRef.current = { action: 'panning', panStart: { screenX: screenPos.x, screenY: screenPos.y, camX: camera.x, camY: camera.y } };
      return;
    }

    if (e.button !== 0) return; // ignore right click for drawing

    // ── Eraser ──
    if (t === 'eraser') {
      const hit = [...els].reverse().find(el => isPointInElement(el, x, y));
      if (hit) dispatch(eraseElement(hit.id));
      return;
    }

    // ── Text tool: click to place textarea ──
    if (t === 'text') {
      const hit = [...els].reverse().find(el => isPointInElement(el, x, y));
      if (hit && hit.type === 'text') {
        setTextEditing({ id: hit.id, x: hit.x1, y: hit.y1, h: (hit.y2 - hit.y1) || 40, fontSize: hit.fontSize || stateRef.current.fontSize });
        setTimeout(() => {
          if (textInputRef.current) {
            textInputRef.current.focus();
            textInputRef.current.setSelectionRange(textInputRef.current.value.length, textInputRef.current.value.length);
          }
        }, 30);
        return;
      }

      const id = uuid();
      const newEl = { id, type: 'text', x1: x, y1: y, x2: x + 200, y2: y + 40,
        text: '', strokeColor: sc, fillColor: 'transparent', strokeWidth: sw, lineStyle: ls, opacity: op, textAlign: stateRef.current.textAlign, fontFamily: stateRef.current.fontFamily, fontSize: stateRef.current.fontSize };
      dispatch(addElement(newEl));
      setTextEditing({ id, x, y, h: 40, fontSize: stateRef.current.fontSize });
      setTimeout(() => textInputRef.current?.focus(), 30);
      return;
    }

    // ── Sticky tool: click to place and edit ──
    if (t === 'sticky') {
      const hit = [...els].reverse().find(el => isPointInElement(el, x, y));
      if (hit && hit.type === 'sticky') {
        setTextEditing({ id: hit.id, x: hit.x1, y: hit.y1, h: (hit.y2 - hit.y1) || 150, fontSize: hit.fontSize || stateRef.current.fontSize });
        setTimeout(() => {
          if (textInputRef.current) {
            textInputRef.current.focus();
            textInputRef.current.setSelectionRange(textInputRef.current.value.length, textInputRef.current.value.length);
          }
        }, 30);
        return;
      }

      const id = uuid();
      const size = 150; // default sticky size
      const newEl = { id, type: 'sticky', x1: x, y1: y, x2: x + size, y2: y + size,
        text: '', strokeColor: sc, fillColor: fc === 'transparent' ? '#fef3c7' : fc, strokeWidth: sw, lineStyle: ls, opacity: op, textAlign: 'center', fontFamily: stateRef.current.fontFamily, fontSize: stateRef.current.fontSize || 16 };
      dispatch(addElement(newEl));
      setTextEditing({ id, x, y, h: size, fontSize: stateRef.current.fontSize || 16 });
      setTimeout(() => textInputRef.current?.focus(), 30);
      return;
    }

    // ── Selection tool ──
    if (t === 'selection') {
      // Check resize handle (single and group selection)
      if (selIds.length >= 1) {
        const bb = getBoundingBox(els, selIds);
        if (bb) {
          const paddedBb = { minX: bb.minX - 10, minY: bb.minY - 10, maxX: bb.maxX + 10, maxY: bb.maxY + 10 };
          const handle = getHandleAtPos(paddedBb, x, y);
          if (handle) {
            const snapshot = els.map(el => ({ ...el, points: el.points ? el.points.map(p => ({ ...p })) : undefined }));
            interRef.current = { action: 'resizing', resizeHandle: handle, moveStart: { x, y, bb, snapshot } };
            return;
          }
        }
      }

      // Check if clicking inside selection bounding box (multiple items / group dragging)
      if (selIds.length > 0) {
        const bb = getBoundingBox(els, selIds);
        if (bb && x >= bb.minX && x <= bb.maxX && y >= bb.minY && y <= bb.maxY) {
           // We are clicking inside the selected area! Start dragging the selection.
           const snapshot = els.map(el => ({ ...el, points: el.points ? el.points.map(p => ({ ...p })) : undefined }));
           interRef.current = { action: 'moving', moveStart: { x, y, snapshot } };
           return;
        }
      }

      // Check if clicking on a specific element
      const hit = [...els].reverse().find(el => isPointInElement(el, x, y));
      if (hit) {
        // Expand group selection
        let idsToSelect = [hit.id];
        if (hit.groupId) idsToSelect = els.filter(el => el.groupId === hit.groupId).map(el => el.id);

        if (e.shiftKey) {
          // Toggle individual element
          const newIds = selIds.includes(hit.id)
            ? selIds.filter(id => id !== hit.id)
            : [...selIds, ...idsToSelect.filter(id => !selIds.includes(id))];
          dispatch(setSelectedIds(newIds));
        } else {
          if (!selIds.includes(hit.id)) dispatch(setSelectedIds(idsToSelect));
        }
        // Start moving
        const snapshot = els.map(el => ({ ...el, points: el.points ? el.points.map(p => ({ ...p })) : undefined }));
        interRef.current = { action: 'moving', moveStart: { x, y, snapshot } };
        return;
      }

      // Clicked empty space — start rubber-band
      if (!e.shiftKey) dispatch(clearSelection());
      interRef.current = { action: 'rubber-band', rubberBand: { x1: x, y1: y, x2: x, y2: y } };
      setRubberBand({ x1: x, y1: y, x2: x, y2: y });
      return;
    }

    // ── Drawing tools ──
    const newEl = {
      id: uuid(),
      type: t,
      x1: x, y1: y, x2: x, y2: y,
      points: t === 'pencil' ? [{ x, y }] : undefined,
      strokeColor: sc,
      fillColor: fc,
      strokeWidth: sw,
      lineStyle: ls,
      opacity: op,
      text: '',
    };
    dispatch(addElement(newEl));
    // Import pending library elements logic has been removed.
    // Elements are now dragged and dropped from the sidebar individually. 
    interRef.current = { action: 'drawing', drawingEl: newEl };
  };

  // ─── Pointer Move ────────────────────────────────────────────────
  const onPointerMove = (e) => {
    const screenPos = getScreenPos(e);
    const { x, y } = getPos(e);
    mousePosRef.current = screenPos;
    emitCursor(x, y);

    const { action, drawingEl, moveStart, resizeHandle, rubberBand: rb, panStart } = interRef.current;
    const { tool: t, elements: els, selectedIds: selIds, camera } = stateRef.current;

    // Panning
    if (action === 'panning' && panStart) {
      const dx = screenPos.x - panStart.screenX;
      const dy = screenPos.y - panStart.screenY;
      setActivePan({ dx, dy });
      return;
    }

    // Eraser drag
    if (t === 'eraser' && e.buttons === 1) {
      const hit = [...els].reverse().find(el => isPointInElement(el, x, y));
      if (hit) dispatch(eraseElement(hit.id));
      return;
    }

    // Rubber-band selection
    if (action === 'rubber-band') {
      const newRb = { ...rb, x2: x, y2: y };
      interRef.current.rubberBand = newRb;
      setRubberBand(newRb);
      return;
    }

    // Moving selected elements
    if (action === 'moving' && moveStart) {
      const dx = x - moveStart.x, dy = y - moveStart.y;
      const { snapshot } = moveStart;
      const updatedEls = snapshot
        .filter(el => selIds.includes(el.id))
        .map(el => ({
          ...el,
          x1: el.x1 + dx, y1: el.y1 + dy,
          x2: (el.x2 ?? el.x1) + dx, y2: (el.y2 ?? el.y1) + dy,
          points: el.points ? el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) : undefined,
        }));
      dispatch(updateElements(updatedEls));
      updatedEls.forEach(el => emitEl(el));
      return;
    }

    // Resizing
    if (action === 'resizing' && moveStart && selIds.length >= 1) {
      const dx = x - moveStart.x, dy = y - moveStart.y;
      const { snapshot, bb } = moveStart;
      
      let newBb = { ...bb };
      switch (resizeHandle) {
        case 'se': newBb.maxX += dx; newBb.maxY += dy; break;
        case 'sw': newBb.minX += dx; newBb.maxY += dy; break;
        case 'ne': newBb.maxX += dx; newBb.minY += dy; break;
        case 'nw': newBb.minX += dx; newBb.minY += dy; break;
        case 'n':  newBb.minY += dy; break;
        case 's':  newBb.maxY += dy; break;
        case 'e':  newBb.maxX += dx; break;
        case 'w':  newBb.minX += dx; break;
      }

      // Prevent negative/zero dimensions, allow a minimum size
      if (newBb.maxX - newBb.minX < 5) {
         if (['w', 'nw', 'sw'].includes(resizeHandle)) newBb.minX = newBb.maxX - 5;
         else newBb.maxX = newBb.minX + 5;
      }
      if (newBb.maxY - newBb.minY < 5) {
         if (['n', 'nw', 'ne'].includes(resizeHandle)) newBb.minY = newBb.maxY - 5;
         else newBb.maxY = newBb.minY + 5;
      }

      const bbW = bb.maxX - bb.minX || 1;
      const bbH = bb.maxY - bb.minY || 1;
      const scaleX = (newBb.maxX - newBb.minX) / bbW;
      const scaleY = (newBb.maxY - newBb.minY) / bbH;
      
      const updatedEls = snapshot
        .filter(el => selIds.includes(el.id))
        .map(el => {
           const mapX = (vx) => newBb.minX + (vx - bb.minX) * scaleX;
           const mapY = (vy) => newBb.minY + (vy - bb.minY) * scaleY;
           
           return {
             ...el,
             x1: mapX(el.x1),
             y1: mapY(el.y1),
             ...(el.x2 !== undefined ? { x2: mapX(el.x2) } : {}),
             ...(el.y2 !== undefined ? { y2: mapY(el.y2) } : {}),
             points: el.points ? el.points.map(p => ({ x: mapX(p.x), y: mapY(p.y) })) : undefined,
             ...(el.type === 'text' && el.fontSize ? { fontSize: el.fontSize * Math.min(scaleX, scaleY) } : {})
           };
        });
        
      dispatch(updateElements(updatedEls));
      updatedEls.forEach(e => emitEl(e));
      return;
    }

    // Drawing
    if (action === 'drawing' && drawingEl) {
      let updated;
      if (t === 'pencil') {
        updated = { ...drawingEl, points: [...(drawingEl.points || []), { x, y }], x2: x, y2: y };
      } else {
        // Shift constrains to square / 45deg
        let nx = x, ny = y;
        if (e.shiftKey && ['rectangle','ellipse','line','arrow'].includes(t)) {
          const dx = Math.abs(x - drawingEl.x1), dy = Math.abs(y - drawingEl.y1);
          if (['rectangle','ellipse'].includes(t)) { const s = Math.max(dx,dy); nx = drawingEl.x1 + (x > drawingEl.x1 ? s : -s); ny = drawingEl.y1 + (y > drawingEl.y1 ? s : -s); }
        }
        updated = { ...drawingEl, x2: nx, y2: ny };
      }
      dispatch(updateElement(updated));
      interRef.current.drawingEl = updated;
      emitEl(updated);
    }
  };

  // ─── Pointer Up ──────────────────────────────────────────────────
  const onPointerUp = (e) => {
    const { action, drawingEl, moveStart, resizeHandle, panStart } = interRef.current;
    const { elements: els, selectedIds: selIds, camera } = stateRef.current;

    if (action === 'panning' && panStart && activePan) {
       dispatch(setCamera({ x: panStart.camX + activePan.dx, y: panStart.camY + activePan.dy, zoom: camera.zoom }));
       setActivePan(null);
    }

    if (action === 'drawing' && drawingEl) {
      dispatch({ type: 'board/finaliseElement', payload: drawingEl });
      if (stateRef.current.tool !== 'pencil') {
        dispatch({ type: 'board/setSelectedIds', payload: [drawingEl.id] });
        dispatch({ type: 'board/setTool', payload: 'selection' });
      }
    }
    if (action === 'moving' && moveStart) {
      const updatedEls = els.filter(el => selIds.includes(el.id));
      dispatch(finaliseElements(updatedEls));
    }
    if (action === 'resizing' && selIds.length === 1) {
      const el = els.find(e => e.id === selIds[0]);
      if (el) dispatch(finaliseElement(el));
    }
    if (action === 'rubber-band' && interRef.current.rubberBand) {
      const rb = interRef.current.rubberBand;
      const inBox = getElementsInRect(els, rb);
      if (inBox.length > 0) {
         // also expand to groups if rubber band caught part of a group
         let expandedIds = new Set(inBox.map(e => e.id));
         inBox.forEach(el => {
           if (el.groupId) {
             els.filter(e => e.groupId === el.groupId).forEach(e => expandedIds.add(e.id));
           }
         });
         dispatch(setSelectedIds(Array.from(expandedIds)));
      }
      setRubberBand(null);
    }

    interRef.current = { action: 'none' };
  };

  // ─── Cursor style ─────────────────────────────────────────────────
  const getCursor = () => {
    if (isSpacePressed) return 'grab';
    if (interRef.current.action === 'panning') return 'grabbing';
    const t = stateRef.current.tool;
    if (t === 'eraser') return 'none';
    if (t === 'text')   return 'text';
    if (t === 'selection') return 'default';
    return 'crosshair';
  };

  // ─── Text input font size ─────────────────────────────────────────
  const textFontSize = textEditing?.fontSize || 20;
  
  // Handlers for zoom UI
  const handleZoomIn = () => dispatch(setCamera({ ...camera, zoom: Math.min(5, camera.zoom + 0.1) }));
  const handleZoomOut = () => dispatch(setCamera({ ...camera, zoom: Math.max(0.1, camera.zoom - 0.1) }));
  const handleZoomReset = () => dispatch(setCamera({ x: 0, y: 0, zoom: 1 }));
  const handleDragOver = (e) => {
    e.preventDefault(); // Allow drop
  };

  const handleDrop = (e) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const parsedData = JSON.parse(dataStr);
      if (parsedData.type !== 'sketchsync-library-item') return;

      const items = parsedData.elements;
      if (!items || items.length === 0) return;

      // Calculate the canvas coordinates of the drop
      const { camera } = stateRef.current;
      const rect = canvasRef.current.getBoundingClientRect();
      const dropX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const dropY = (e.clientY - rect.top - camera.y) / camera.zoom;

      // Find bounding box of the items to center them at drop location
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      items.forEach(el => {
        minX = Math.min(minX, el.x1 || 0, el.x2 || el.x1 || 0);
        minY = Math.min(minY, el.y1 || 0, el.y2 || el.y1 || 0);
        maxX = Math.max(maxX, el.x1 || 0, el.x2 || el.x1 || 0);
        maxY = Math.max(maxY, el.y1 || 0, el.y2 || el.y1 || 0);
      });
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const dx = dropX - cx;
      const dy = dropY - cy;

      const groupMap = {};

      const newElements = items.map(el => {
        let newGroupId = el.groupId;
        if (el.groupId) {
          if (!groupMap[el.groupId]) groupMap[el.groupId] = `g_${uuid()}`;
          newGroupId = groupMap[el.groupId];
        }

        let newGroupIds = el.groupIds;
        if (el.groupIds) {
          newGroupIds = el.groupIds.map(gid => {
            if (!groupMap[gid]) groupMap[gid] = `g_${uuid()}`;
            return groupMap[gid];
          });
        }

        return {
          ...el,
          id: uuid(),
          groupId: newGroupId,
          ...(newGroupIds ? { groupIds: newGroupIds } : {}),
          x1: (el.x1 || 0) + dx,
          y1: (el.y1 || 0) + dy,
          x2: (el.x2 !== undefined ? el.x2 : (el.x1 || 0)) + dx,
          y2: (el.y2 !== undefined ? el.y2 : (el.y1 || 0)) + dy,
          points: el.points ? el.points.map(p => ({
            x: p.x + dx,
            y: p.y + dy,
          })) : undefined,
        };
      });

      newElements.forEach(el => dispatch(addElement(el)));
      dispatch(setSelectedIds(newElements.map(e => e.id)));
      dispatch({ type: 'board/setTool', payload: 'selection' });
    } catch (err) {
      console.error('Drop parsing error', err);
    }
  };

  return (
    <div 
      className="canvas-container"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        id="main-canvas"
        className="main-canvas"
        style={{ cursor: getCursor() }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          const { x, y } = getPos(e);
          const { elements: els } = stateRef.current;
          const hit = [...els].reverse().find(el => isPointInElement(el, x, y));
          if (hit && (hit.type === 'text' || hit.type === 'sticky')) {
            setTextEditing({ id: hit.id, x: hit.x1, y: hit.y1, h: (hit.y2 - hit.y1) || (hit.type === 'sticky' ? 150 : 40), fontSize: hit.fontSize || stateRef.current.fontSize });
            setTimeout(() => {
              if (textInputRef.current) {
                textInputRef.current.focus();
                textInputRef.current.setSelectionRange(textInputRef.current.value.length, textInputRef.current.value.length);
              }
            }, 30);
          }
        }}
        onPointerOut={(e) => {
          // Hide eraser if we leave the canvas
          if (stateRef.current.tool === 'eraser') mousePosRef.current = { x: -1000, y: -1000 };
          if (e.buttons === 0 && interRef.current.action !== 'none') {
            onPointerUp(e);
          }
        }}
        onPointerEnter={(e) => {
          if (stateRef.current.tool === 'eraser') {
             mousePosRef.current = getScreenPos(e);
             trailPosRef.current = { ...mousePosRef.current };
          }
        }}
      />

      {/* Premium Stretchy Eraser Cursor */}
      {stateRef.current.tool === 'eraser' && (
        <>
          {/* Shadow/Trail */}
          <div
            ref={eraserTrailRef}
            style={{
              position: 'absolute',
              height: 16,
              borderRadius: 8,
              backgroundColor: 'rgba(150, 150, 150, 0.4)',
              pointerEvents: 'none',
              zIndex: 9998,
              transformOrigin: '8px 8px',
              opacity: 0,
            }}
          />
          {/* Hollow Circle (Actual cursor) */}
          <div
            ref={eraserCursorRef}
            style={{
              position: 'absolute',
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: `2px solid ${theme === 'light' ? 'rgba(0,0,0,0.8)' : 'rgba(255, 255, 255, 0.9)'}`,
              boxShadow: '0 0 4px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 9999,
              transform: 'translate(-50%, -50%)',
              opacity: 0,
            }}
          />
        </>
      )}

      {/* Zoom Controls Overlay */}
      <div className="zoom-controls">
        <button onClick={handleZoomOut} title="Zoom Out" className="zoom-btn">-</button>
        <button onClick={handleZoomReset} title="Reset Zoom" className="zoom-value">{Math.round(camera.zoom * 100)}%</button>
        <button onClick={handleZoomIn} title="Zoom In" className="zoom-btn">+</button>
      </div>

      {/* Selection Context Toolbar */}
      {selectionBB && (
        <div
          className="context-toolbar"
          style={{
            position: 'absolute',
            left: ((selectionBB.minX + selectionBB.maxX) / 2) * camera.zoom + camera.x,
            top: Math.max(16, selectionBB.minY * camera.zoom + camera.y - 56),
          }}
        >
          <button className="tool-btn-tb" title="Bring Forward" onClick={() => dispatch(bringToFront())}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg></span>
          </button>
          <button className="tool-btn-tb" title="Send Backward" onClick={() => dispatch(sendToBack())}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg></span>
          </button>
          <div className="toolbar-separator" style={{ height: '20px' }} />
          <button className="tool-btn-tb" title="Duplicate" onClick={() => dispatch(duplicateSelected())}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg></span>
          </button>
          <button className="tool-btn-tb" style={{ color: '#ef4444' }} title="Delete" onClick={() => dispatch(deleteSelected())}>
            <span className="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg></span>
          </button>
        </div>
      )}

      {/* Inline text editor overlay */}
      {textEditing && (() => {
        const editingEl = elements.find(e => e.id === textEditing.id);
        const isSticky = editingEl?.type === 'sticky';
        const elWidth = isSticky ? Math.abs((editingEl.x2 || editingEl.x1) - editingEl.x1) : 'auto';
        const isCenter = isSticky || editingEl?.textAlign === 'center';
        const isRight = editingEl?.textAlign === 'right';

        return (
        <textarea
          ref={textInputRef}
          className="canvas-text-overlay"
          style={{
            left:     textEditing.x * camera.zoom + camera.x,
            top:      textEditing.y * camera.zoom + camera.y,
            fontSize: `${textFontSize * camera.zoom}px`,
            color: (() => {
              const elColor = editingEl?.strokeColor || stateRef.current.strokeColor;
              if (theme === 'light' && elColor === '#ffffff') return '#1e1e1e';
              if (theme === 'dark' && (elColor === '#000000' || elColor === '#1e1e1e')) return '#ffffff';
              return elColor;
            })(),
            opacity:  stateRef.current.opacity / 100,
            transformOrigin: 'top left',
            textAlign: isSticky ? 'center' : (editingEl?.textAlign || 'left'),
            width: isSticky ? `${elWidth * camera.zoom}px` : 'auto',
            transform: isCenter && !isSticky ? 'translateX(-50%)' : (isRight && !isSticky ? 'translateX(-100%)' : 'none'),
          }}
          placeholder="Type here…"
          rows={1}
          defaultValue={editingEl?.text || ''}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
            if (!isSticky) {
              e.target.style.width = 'auto';
              e.target.style.width = Math.max(100, e.target.scrollWidth) + 'px';
            }
          }}
          onBlur={(e) => commitText(textEditing.id, e.target.value, isSticky ? null : Math.max(100, e.target.scrollWidth), isSticky ? null : e.target.scrollHeight)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') commitText(textEditing.id, e.target.value, isSticky ? null : Math.max(100, e.target.scrollWidth), isSticky ? null : e.target.scrollHeight);
          }}
        />
        );
      })()}

      {/* Remote cursors */}
      {Object.entries(remoteCursors).map(([uid, { x, y, name, avatar }]) => (
        <div key={uid} className="remote-cursor" style={{ left: x * camera.zoom + camera.x, top: y * camera.zoom + camera.y }}>
          {avatar ? (
            <img src={avatar} alt={name} className="remote-cursor-img" referrerPolicy="no-referrer" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#7C3AED" className="remote-cursor-fallback">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
          <span className="remote-cursor-label">{name}</span>
        </div>
      ))}
    </div>
  );
}
