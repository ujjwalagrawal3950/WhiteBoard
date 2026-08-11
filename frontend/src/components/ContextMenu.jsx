import { useSelector, useDispatch } from 'react-redux';
import { 
  deleteSelected, 
  duplicateSelected, 
  bringToFront, 
  sendToBack 
} from '../store/boardSlice';
import { getBoundingBox } from '../utils/drawing'; // Force Vite reload

export default function ContextMenu() {
  const dispatch = useDispatch();
  const { elements, selectedIds, camera } = useSelector((state) => state.board);

  if (selectedIds.length === 0) return null;

  // Calculate the screen position for the context menu
  const bb = getBoundingBox(elements, selectedIds);
  if (!bb) return null;

  // Position it centered above the top edge of the bounding box
  const screenX = (bb.minX + (bb.maxX - bb.minX) / 2) * camera.zoom + camera.x;
  const screenY = bb.minY * camera.zoom + camera.y - 10; // 10px above the box

  return (
    <div 
      className="context-menu"
      style={{
        left: screenX,
        top: screenY,
      }}
      onPointerDown={(e) => e.stopPropagation()} // Prevent dropping selection
    >
      <button 
        className="context-btn" 
        onClick={() => dispatch(bringToFront())}
        title="Bring to Front"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="8" width="12" height="12" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
      </button>
      
      <button 
        className="context-btn" 
        onClick={() => dispatch(sendToBack())}
        title="Send to Back"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="12" height="12" rx="2" ry="2"/>
          <path d="M20 8c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H10c-1.1 0-2-.9-2-2"/>
        </svg>
      </button>

      <div className="context-divider" />

      <button 
        className="context-btn" 
        onClick={() => dispatch(duplicateSelected())}
        title="Duplicate (Ctrl+D)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>

      <button 
        className="context-btn context-btn-danger" 
        onClick={() => dispatch(deleteSelected())}
        title="Delete (Backspace)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  );
}
