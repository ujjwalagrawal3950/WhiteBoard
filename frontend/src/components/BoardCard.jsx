import { useState } from 'react';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MiniPreview({ elements }) {
  if (!elements || elements.length === 0) {
    return (
      <div className="board-preview-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        <span>Empty board</span>
      </div>
    );
  }

  // Render a miniature SVG preview of the first few elements
  const preview = elements.slice(0, 20);
  return (
    <svg className="board-preview-svg" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet">
      {preview.map((el) => {
        if (el.type === 'rectangle') {
          return (
            <rect key={el.id}
              x={el.x1} y={el.y1}
              width={Math.abs(el.x2 - el.x1)} height={Math.abs(el.y2 - el.y1)}
              stroke={el.strokeColor || '#888'} strokeWidth={el.strokeWidth || 1}
              fill="none" />
          );
        }
        if (el.type === 'pencil' && el.points?.length > 1) {
          const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return <path key={el.id} d={d} stroke={el.strokeColor || '#888'} strokeWidth={el.strokeWidth || 1} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
        }
        if (el.type === 'text' && el.text) {
          return <text key={el.id} x={el.x1} y={el.y1} fill={el.strokeColor || '#888'} fontSize="12">{el.text}</text>;
        }
        return null;
      })}
    </svg>
  );
}

export default function BoardCard({ board, onDelete, onOpen }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/board/${board._id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const confirmDelete = (e) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div className="board-card" onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      
      <div className="board-card-preview">
        <MiniPreview elements={board.elements} />
        <div className="board-card-overlay">
          <button id={`open-board-${board._id}`} className="btn-open">Open →</button>
        </div>
      </div>

      <div className="board-card-body">
        <div className="board-card-info">
          <h3 className="board-card-title">{board.title}</h3>
          <span className="board-card-date">Updated {formatDate(board.updatedAt)}</span>
        </div>

        <div className="board-card-actions" onClick={e => e.stopPropagation()}>
          {!showConfirm ? (
            <>
              <button
                id={`share-btn-${board._id}`}
                className={`icon-btn ${copied ? 'icon-btn-success' : ''}`}
                title="Copy share link"
                onClick={handleShare}
              >
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                )}
              </button>
              <button
                id={`delete-btn-${board._id}`}
                className="icon-btn icon-btn-danger"
                title="Delete board"
                onClick={handleDeleteClick}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </>
          ) : (
            <>
              <button className="btn-confirm-delete" onClick={confirmDelete}>Delete</button>
              <button className="btn-cancel" onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
