import { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setCamera } from '../store/boardSlice';

export default function MiniMap() {
  const dispatch = useDispatch();
  const { elements, camera } = useSelector((state) => state.board);
  const canvasRef = useRef(null);
  
  // Track viewport dimensions
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [viewRect, setViewRect] = useState({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 1. Determine the bounds of the entire board (all elements + current viewport)
    let minX = -camera.x / camera.zoom;
    let minY = -camera.y / camera.zoom;
    let maxX = (-camera.x + viewport.w) / camera.zoom;
    let maxY = (-camera.y + viewport.h) / camera.zoom;

    elements.forEach(el => {
      minX = Math.min(minX, el.x1, el.x2 ?? el.x1);
      minY = Math.min(minY, el.y1, el.y2 ?? el.y1);
      maxX = Math.max(maxX, el.x1, el.x2 ?? el.x1);
      maxY = Math.max(maxY, el.y1, el.y2 ?? el.y1);
      if (el.points) {
        el.points.forEach(p => {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
      }
    });

    // Add some padding to the bounds
    const padding = 200;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;

    const boardW = Math.max(maxX - minX, 1);
    const boardH = Math.max(maxY - minY, 1);

    // Map bounds to minimap canvas (160x120)
    const scaleX = canvas.width / boardW;
    const scaleY = canvas.height / boardH;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - boardW * scale) / 2 - minX * scale;
    const offsetY = (canvas.height - boardH * scale) / 2 - minY * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw elements as simple gray boxes/lines
    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'; // slate-400 with opacity
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 1;

    elements.forEach(el => {
      const ex1 = el.x1 * scale + offsetX;
      const ey1 = el.y1 * scale + offsetY;
      const ex2 = (el.x2 ?? el.x1) * scale + offsetX;
      const ey2 = (el.y2 ?? el.y1) * scale + offsetY;
      
      const ew = Math.abs(ex2 - ex1);
      const eh = Math.abs(ey2 - ey1);
      const rx = Math.min(ex1, ex2);
      const ry = Math.min(ey1, ey2);

      if (el.type === 'pencil' && el.points) {
        ctx.beginPath();
        el.points.forEach((p, i) => {
          const px = p.x * scale + offsetX;
          const py = p.y * scale + offsetY;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      } else if (el.type === 'line' || el.type === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(ex1, ey1);
        ctx.lineTo(ex2, ey2);
        ctx.stroke();
      } else {
        // Shapes & text just drawn as rectangles
        ctx.fillRect(rx, ry, Math.max(ew, 2), Math.max(eh, 2));
      }
    });

    // Save mapping data to canvas dataset for click/drag handling
    canvas.dataset.scale = scale;
    canvas.dataset.offsetX = offsetX;
    canvas.dataset.offsetY = offsetY;

    // Update viewport rect state
    setViewRect({
      left: (-camera.x / camera.zoom) * scale + offsetX,
      top: (-camera.y / camera.zoom) * scale + offsetY,
      width: (viewport.w / camera.zoom) * scale,
      height: (viewport.h / camera.zoom) * scale
    });

  }, [elements, camera, viewport]);

  // Handle clicking and dragging on the minimap
  const handleMapInteraction = (e) => {
    if (e.buttons !== 1) return; // only left click
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mapX = e.clientX - rect.left;
    const mapY = e.clientY - rect.top;
    
    const scale = parseFloat(canvas.dataset.scale);
    const offsetX = parseFloat(canvas.dataset.offsetX);
    const offsetY = parseFloat(canvas.dataset.offsetY);

    if (!scale) return;

    // Convert map click to board coordinates
    const boardX = (mapX - offsetX) / scale;
    const boardY = (mapY - offsetY) / scale;

    // Center the camera on this board coordinate
    dispatch(setCamera({
      ...camera,
      x: -boardX * camera.zoom + viewport.w / 2,
      y: -boardY * camera.zoom + viewport.h / 2
    }));
  };

  return (
    <div className="minimap-container">
      <canvas
        ref={canvasRef}
        width={160}
        height={120}
        className="minimap-canvas"
      />
      <div 
        className="minimap-viewport"
        style={{
          left: viewRect.left,
          top: viewRect.top,
          width: viewRect.width,
          height: viewRect.height,
        }}
      />
      {/* Invisible overlay to capture pointer events smoothly */}
      <div 
        style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
        onPointerDown={handleMapInteraction}
        onPointerMove={handleMapInteraction}
      />
    </div>
  );
}
