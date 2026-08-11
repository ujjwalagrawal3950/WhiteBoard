import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { setSelectedIds, setCamera, addComment, deleteComment } from '../store/boardSlice';
import { useSocket } from '../context/SocketContext';
import { v4 as uuid } from 'uuid';
import { convertExcalidrawElements } from '../utils/excalidrawImport';
import { generateThumbnail } from '../utils/drawing';

// ─── Canvas text search — O(n) scan using V8 native indexOf ─────────────────
function searchCanvasText(elements, query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if ((el.type === 'text' || el.type === 'sticky') && el.text) {
      if (el.text.toLowerCase().indexOf(q) !== -1) {
        results.push({
          id: el.id,
          text: el.text,
          type: el.type,
          x: el.x1,
          y: el.y1,
        });
      }
    }
  }
  return results;
}

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  {
    id: 'search', label: 'Search',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  },
  {
    id: 'library', label: 'Library',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  },
  {
    id: 'chat', label: 'Chat',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  {
    id: 'comments', label: 'Comments',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
  },
  {
    id: 'tasks', label: 'Tasks',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  },
];

// ─── Imported library storage key ────────────────────────────────────────────
const IMPORTED_LIBS_KEY = 'sketchsync_imported_libraries';

function getImportedLibraries() {
  try {
    const saved = localStorage.getItem(IMPORTED_LIBS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveImportedLibraries(libs) {
  try {
    localStorage.setItem(IMPORTED_LIBS_KEY, JSON.stringify(libs));
  } catch { /* quota exceeded */ }
}

// ──────────────────────────────────────────────────────────────────────────────
// LIBRARY SIDEBAR COMPONENT
// ──────────────────────────────────────────────────────────────────────────────
export default function LibrarySidebar({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [importedLibs, setImportedLibs] = useState(getImportedLibraries);
  const [libSearchQuery, setLibSearchQuery] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id: boardId } = useParams();
  const socketRef = useSocket();
  const { user } = useSelector(s => s.auth);
  const elements = useSelector(s => s.board.elements);
  const camera = useSelector(s => s.board.camera);
  const { selectedIds, comments } = useSelector(s => s.board);
  const searchInputRef = useRef(null);
  
  const [commentText, setCommentText] = useState('');
  
  const handleAddComment = () => {
    if (!commentText.trim() || selectedIds.length === 0) return;
    const newComment = {
      id: uuid(),
      text: commentText.trim(),
      author: user?.name || 'Guest',
      timestamp: Date.now(),
      elementIds: [...selectedIds]
    };
    dispatch(addComment(newComment));
    setCommentText('');
    const socket = socketRef?.current;
    if (socket && boardId) {
      socket.emit('comment-update', { boardId, comment: newComment });
    }
  };
  const debounceRef = useRef(null);
  const fileInputRef = useRef(null);

  // ─── Excalidraw Upload ──────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        let items = [];

        if (parsed.libraryItems && Array.isArray(parsed.libraryItems)) {
          items = parsed.libraryItems;
        } else if (parsed.library && Array.isArray(parsed.library)) {
          items = parsed.library;
        } else if (Array.isArray(parsed)) {
          if (parsed.length > 0 && parsed[0].elements) {
            items = parsed; // Array of library items
          } else {
            // Flat array of elements
            items = [{ isFlatArray: true, elements: parsed }];
          }
        } else {
          // Flat array of elements inside an object
          items = [{ isFlatArray: true, elements: parsed.elements || [] }];
        }

        if (items.length === 0) {
          alert('No library items or drawing elements found in this file.');
          return;
        }

        const newItems = [];
        
        // Helper to process a flat array of elements into grouped items
        const processFlatElements = (flatElements) => {
          const groups = {};
          const standalones = [];
          
          for (const el of flatElements) {
            const gId = el.groupId || (el.groupIds && el.groupIds.length > 0 ? el.groupIds[0] : null);
            if (gId) {
              if (!groups[gId]) groups[gId] = [];
              groups[gId].push(el);
            } else {
              standalones.push(el);
            }
          }
          
          for (const gId in groups) {
            newItems.push({ elements: groups[gId] });
          }
          for (const el of standalones) {
            newItems.push({ elements: [el] });
          }
        };

        for (const item of items) {
          if (item.isFlatArray) {
            processFlatElements(item.elements);
            continue;
          }

          let rawElements = [];
          if (item.elements) rawElements = item.elements;
          else if (Array.isArray(item)) rawElements = item;
          else rawElements = [item];

          // If this "item" itself turned out to just be a single raw shape with a groupId,
          // it might mean the top-level array was actually flat.
          // But normally, if item.elements exists, it's a true library item.
          if (rawElements.length === 0) continue;

          newItems.push({ elements: rawElements });
        }

        if (newItems.length === 0) {
          alert('No valid drawing elements found.');
          return;
        }

        // Now convert and forcefully group each constructed item, and generate thumbnails
        const finalItems = [];
        for (const item of newItems) {
          let converted = convertExcalidrawElements(item.elements);
          
          // Forcefully group all shapes in this library item together
          // so they don't split apart when dropped on the canvas.
          const masterGroupId = `g_${uuid()}`;
          converted = converted.map(el => ({ ...el, groupId: masterGroupId }));

          // Generate thumbnail for the sidebar icon
          const thumb = await generateThumbnail(converted, 150, 150, 2);

          finalItems.push({
            id: uuid(),
            thumbnail: thumb || '',
            elements: converted
          });
        }

        const newLib = {
          id: uuid(),
          name: file.name.replace(/\.(excalidraw|excalidrawlib|json)$/i, ''),
          items: finalItems,
          itemCount: finalItems.length,
        };

        const current = getImportedLibraries();
        const updated = [newLib, ...current];
        saveImportedLibraries(updated);
        setImportedLibs(updated);
      } catch (err) {
        console.error('Failed to parse Excalidraw file', err);
        alert('Failed to parse Excalidraw file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Check for pending import from LibrariesPage
  useEffect(() => {
    if (!isOpen) return;
    try {
      const pending = localStorage.getItem('sketchsync_pending_import');
      if (pending) {
        const lib = JSON.parse(pending);
        localStorage.removeItem('sketchsync_pending_import');
        // Add to imported list
        const current = getImportedLibraries();
        if (!current.find(l => l.id === lib.id)) {
          const updated = [lib, ...current];
          saveImportedLibraries(updated);
          setImportedLibs(updated);
        }
        setActiveTab('library');
      }
    } catch { /* ignore */ }
  }, [isOpen]);

  // Auto-focus search when switching to search tab
  useEffect(() => {
    if (activeTab === 'search' && isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [activeTab, isOpen]);

  // ─── Search results (debounced) ─────────────────────────────────────────────
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const searchResults = useMemo(
    () => searchCanvasText(elements, debouncedQuery),
    [elements, debouncedQuery]
  );

  const handleResultClick = useCallback((result) => {
    dispatch(setSelectedIds([result.id]));
    // Pan camera to center the element
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    dispatch(setCamera({
      x: cx - result.x * camera.zoom,
      y: cy - result.y * camera.zoom,
      zoom: camera.zoom,
    }));
  }, [dispatch, camera.zoom]);

  // ─── Filter imported libraries ──────────────────────────────────────────────
  const filteredLibs = useMemo(() => {
    if (!libSearchQuery.trim()) return importedLibs;
    const q = libSearchQuery.toLowerCase();
    return importedLibs.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.authorName || '').toLowerCase().includes(q)
    );
  }, [importedLibs, libSearchQuery]);

  const handleRemoveLib = (libId) => {
    const updated = importedLibs.filter(l => l.id !== libId);
    saveImportedLibraries(updated);
    setImportedLibs(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="library-sidebar">
      {/* ── Header with tabs ── */}
      <div className="lib-sidebar-header">
        <div className="lib-tab-bar">
          {TABS.map(tab => {
            if (tab.id === 'comments' && !boardId) return null; // Only show on shared boards
            return (
              <button
                key={tab.id}
                className={`lib-tab-btn ${activeTab === tab.id ? 'lib-tab-active' : ''}`}
                title={tab.label}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
              </button>
            );
          })}
        </div>
        <div className="lib-header-actions">
          <button className="lib-header-btn" title="Pin sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
              <line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" />
            </svg>
          </button>
          <button className="lib-header-btn" onClick={onClose} title="Close sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="lib-sidebar-content">
        {/* ═══ SEARCH TAB ═══ */}
        {activeTab === 'search' && (
          <div className="lib-search-panel">
            <div className="lib-search-field">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14" className="lib-search-icon">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search text on canvas…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="lib-search-input"
              />
              {searchQuery && (
                <button className="lib-search-clear" onClick={() => setSearchQuery('')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>

            {debouncedQuery ? (
              <div className="lib-search-results">
                <div className="lib-search-count">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                </div>
                {searchResults.length === 0 ? (
                  <div className="lib-empty-state">
                    <span className="lib-empty-icon">🔍</span>
                    <p>No matching text found on canvas</p>
                  </div>
                ) : (
                  searchResults.map(r => (
                    <button
                      key={r.id}
                      className="lib-search-result"
                      onClick={() => handleResultClick(r)}
                    >
                      <span className="lib-result-type">{r.type === 'sticky' ? '📝' : 'T'}</span>
                      <span className="lib-result-text">{r.text.length > 60 ? r.text.slice(0, 60) + '…' : r.text}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="lib-empty-state">
                <span className="lib-empty-icon">🔍</span>
                <p>Type to search text elements on canvas</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ LIBRARY TAB ═══ */}
        {activeTab === 'library' && (
          <div className="lib-library-panel">
            {/* Search bar for library */}
            <div className="lib-library-search-row">
              <div className="lib-search-field lib-search-field-sm">
                <input
                  type="text"
                  placeholder="Search library"
                  value={libSearchQuery}
                  onChange={e => setLibSearchQuery(e.target.value)}
                  className="lib-search-input"
                />
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
              />
              <button className="lib-menu-btn" title="Import Excalidraw" onClick={() => fileInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
              <button className="lib-menu-btn" title="Options">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
              </button>
            </div>

            {/* Personal Library */}
            <div className="lib-section">
              <h3 className="lib-section-title lib-section-title-primary">Personal Library</h3>
              <p className="lib-section-desc">Select an item on canvas to add it here.</p>
            </div>

            {/* Imported Libraries */}
            {filteredLibs.length > 0 && (
              <div className="lib-section">
                {filteredLibs.map(lib => (
                  <div key={lib.id} className="lib-imported-group">
                    <div className="lib-imported-header">
                      <h3 className="lib-section-title lib-section-title-primary">{lib.name}</h3>
                      <button
                        className="lib-remove-btn"
                        title="Remove library"
                        onClick={() => handleRemoveLib(lib.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                    {lib.items && lib.items.length > 0 ? (
                      <div className="lib-thumbnail-grid">
                        {lib.items.map(item => (
                          <div
                            key={item.id}
                            className="lib-thumbnail-item"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/json', JSON.stringify({
                                type: 'sketchsync-library-item',
                                elements: item.elements
                              }));
                            }}
                            title="Drag to canvas"
                          >
                            {item.thumbnail && <img src={item.thumbnail} alt="Item" className="lib-thumbnail-img" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Fallback for older imports without items array */
                      lib.thumbnail && (
                        <div className="lib-thumbnail-grid">
                          <div className="lib-thumbnail-item">
                            <img src={lib.thumbnail} alt={lib.name} className="lib-thumbnail-img" />
                          </div>
                        </div>
                      )
                    )}
                    
                    {lib.items ? (
                      <span className="lib-item-count">{lib.items.length} items</span>
                    ) : lib.itemCount ? (
                      <span className="lib-item-count">{lib.itemCount} elements</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {/* Empty state when no libs */}
            {filteredLibs.length === 0 && !libSearchQuery && (
              <div className="lib-empty-state lib-empty-large">
                <h3 className="lib-empty-title">No items added yet...</h3>
                <p>Select an item on canvas to add it here, or install a library from the public repository, below.</p>
              </div>
            )}

            {/* Browse Libraries Button */}
            <div className="lib-browse-footer">
              <button
                className="lib-browse-btn"
                onClick={() => navigate('/libraries')}
              >
                Browse libraries
              </button>
            </div>
          </div>
        )}

        {/* ═══ CHAT TAB (placeholder) ═══ */}
        {activeTab === 'chat' && (
          <div className="lib-empty-state lib-empty-large">
            <span className="lib-empty-icon">💬</span>
            <h3 className="lib-empty-title">Chat</h3>
            <p>Coming soon — collaborate with your team in real-time.</p>
          </div>
        )}

        {/* ═══ TASKS TAB (placeholder) ═══ */}
        {activeTab === 'tasks' && (
          <div className="lib-empty-state lib-empty-large">
            <span className="lib-empty-icon">✅</span>
            <h3 className="lib-empty-title">Tasks</h3>
            <p>Coming soon — add and track tasks for your board.</p>
          </div>
        )}

        {/* ═══ COMMENTS TAB ═══ */}
        {activeTab === 'comments' && (
          <div className="lib-comments-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="lib-comments-input-area" style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
              {selectedIds.length > 0 ? (
                <>
                  <textarea 
                    value={commentText} 
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add comment to selected objects..."
                    style={{ width: '100%', minHeight: '60px', background: 'var(--bg-card)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', marginBottom: '8px', resize: 'vertical' }}
                  />
                  <button onClick={handleAddComment} className="btn-primary" style={{ width: '100%', padding: '8px' }}>Post Comment</button>
                </>
              ) : (
                <div className="lib-empty-state" style={{ padding: '20px 0' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', textAlign: 'center' }}>Select one or more objects on the canvas to comment on them.</p>
                </div>
              )}
            </div>
            
            <div className="lib-comments-list" style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {comments.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.9rem', marginTop: '20px' }}>No comments yet.</p>
              ) : (
                comments.slice().reverse().map(comment => (
                  <div key={comment.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ color: 'var(--text-1)', fontSize: '0.9rem' }}>{comment.author}</strong>
                      <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.85rem', marginBottom: '12px', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{comment.text}</p>
                    <button 
                      onClick={() => dispatch(setSelectedIds(comment.elementIds))}
                      className="btn-ghost" 
                      style={{ width: '100%', padding: '6px', fontSize: '0.8rem', border: '1px solid var(--border)' }}
                    >
                      View Objects
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
