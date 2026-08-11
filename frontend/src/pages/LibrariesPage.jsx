import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import { addElement } from '../store/boardSlice';
import JSZip from 'jszip';
import { generateThumbnail } from '../utils/drawing';
import { convertExcalidrawElements } from '../utils/excalidrawImport';

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Normalize elements from Excalidraw format to our format
function normalizeElements(elements) {
  return elements.map(el => {
    const x = el.x !== undefined ? el.x : (el.x1 || 0);
    const y = el.y !== undefined ? el.y : (el.y1 || 0);
    const w = el.width !== undefined ? el.width : Math.abs((el.x2 || 0) - (el.x1 || 0));
    const h = el.height !== undefined ? el.height : Math.abs((el.y2 || 0) - (el.y1 || 0));
    return {
      ...el,
      x1: el.x1 !== undefined ? el.x1 : x,
      y1: el.y1 !== undefined ? el.y1 : y,
      x2: el.x2 !== undefined ? el.x2 : x + w,
      y2: el.y2 !== undefined ? el.y2 : y + h,
    };
  });
}

// Group elements by groupIds or as standalone items
function groupElementsIntoItems(elements) {
  const groups = {};
  const standalone = [];
  
  elements.forEach(el => {
    const topGroupId = el.groupId || (el.groupIds && el.groupIds.length > 0 ? el.groupIds[0] : null);
    if (topGroupId) {
      if (!groups[topGroupId]) groups[topGroupId] = [];
      groups[topGroupId].push(el);
    } else {
      standalone.push([el]);
    }
  });

  return [...Object.values(groups), ...standalone];
}

export default function LibrariesPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector(s => s.auth);

  // ─── State ─────────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [importing, setImporting] = useState(null); // template id being imported

  const debouncedSearch = useDebounce(searchInput, 400);

  // ─── Fetch templates ───────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async (searchQuery, pageNum) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 20 });
      if (searchQuery) params.set('search', searchQuery);
      const { data } = await axios.get(`/api/libraries?${params.toString()}`, { withCredentials: true });
      setTemplates(data.templates || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch libraries:', err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchTemplates(debouncedSearch, page);
  }, [debouncedSearch, page, fetchTemplates]);

  // ─── Import template to canvas ─────────────────────────────────────────────
  const handleImport = async (template) => {
    setImporting(template._id);
    try {
      // Fetch full template with elements
      const { data: fullTemplate } = await axios.get(`/api/libraries/${template._id}`, { withCredentials: true });
      const elements = normalizeElements(fullTemplate.elements || []);

      // Increment download counter (fire-and-forget)
      axios.patch(`/api/libraries/${template._id}/download`).catch(() => {});

      // Group elements into distinct items
      const itemGroups = groupElementsIntoItems(elements);
      const items = [];
      
      // Generate a thumbnail for each group
      for (const group of itemGroups) {
        const thumb = await generateThumbnail(group, 150, 150, 2);
        items.push({
          id: uuid(),
          thumbnail: thumb || '',
          elements: group
        });
      }

      // Store in localStorage for the sidebar to pick up
      const importData = {
        id: template._id,
        name: fullTemplate.name,
        authorName: fullTemplate.authorName,
        items: items,
        itemCount: items.length,
        importedAt: Date.now(),
      };
      localStorage.setItem('sketchsync_pending_import', JSON.stringify(importData));

      // Also store the elements to add to canvas
      localStorage.setItem('sketchsync_pending_elements', JSON.stringify(elements));

      // Navigate back
      navigate(-1);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import template. Please try again.');
    } finally {
      setImporting(null);
    }
  };

  // ─── Download template as ZIP (JSON + PNG) ─────────────────────────────────
  const handleDownload = async (template) => {
    try {
      const { data: fullTemplate } = await axios.get(`/api/libraries/${template._id}`, { withCredentials: true });
      axios.patch(`/api/libraries/${template._id}/download`).catch(() => {});

      const elements = normalizeElements(fullTemplate.elements || []);
      const jsonBlob = new Blob([JSON.stringify(elements, null, 2)], { type: 'application/json' });
      
      const zip = new JSZip();
      zip.file(`${template.name}.json`, jsonBlob);
      
      // Generate High-Res PNG thumbnail
      const thumbnailBase64 = await generateThumbnail(elements, 800, 600, 2);
      if (thumbnailBase64) {
        // Strip the data:image/png;base64, prefix
        const base64Data = thumbnailBase64.replace(/^data:image\/(png|jpeg);base64,/, "");
        zip.file(`${template.name}_preview.png`, base64Data, {base64: true});
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.name.replace(/[^a-z0-9]/gi, '_')}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  // ─── Format date ───────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ─── Format download count ─────────────────────────────────────────────────
  const formatDownloads = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  // ─── Upload template from computer ─────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      /*
      if (!user) {
        alert('You must be logged in to upload templates to the public library.');
        return;
      }
      */

      const text = await file.text();
      let parsed = JSON.parse(text);
      let elements = [];

      // Helper to process library items and inject groupIds to preserve structure
      const processItems = (items) => {
        return items.flatMap(item => {
          let rawElements = [];
          if (item.elements) rawElements = item.elements;
          else if (Array.isArray(item)) rawElements = item;
          else rawElements = [item];

          if (rawElements.length === 0) return [];

          // Forcefully inject a unique groupId to preserve this item's grouping
          // when it gets flattened for the backend.
          const masterGroupId = `g_${uuid()}`;
          return rawElements.map(el => ({ 
            ...el, 
            groupId: masterGroupId,
            groupIds: [masterGroupId, ...(el.groupIds || [])] 
          }));
        });
      };

      // Excalidraw library format (v2) or similar
      if (parsed.libraryItems && Array.isArray(parsed.libraryItems)) {
        elements = processItems(parsed.libraryItems);
        parsed.type = 'excalidraw';
      } 
      // Alternative library format
      else if (parsed.library && Array.isArray(parsed.library)) {
        elements = processItems(parsed.library);
        parsed.type = 'excalidraw';
      } 
      // Array format (could be plain elements or v1 library items)
      else if (Array.isArray(parsed)) {
        if (parsed.length > 0 && parsed[0].elements) {
          elements = parsed.flatMap(item => item.elements || []);
          parsed = { type: 'excalidraw' }; // spoof type
        } else {
          elements = parsed;
        }
      } 
      // Standard drawing file format
      else {
        elements = parsed.elements || [];
      }

      if (!Array.isArray(elements) || elements.length === 0) {
        throw new Error(`No elements found. Keys in file: ${Object.keys(parsed).join(', ')}`);
      }
      
      if (parsed.type === 'excalidraw') {
        elements = convertExcalidrawElements(elements);
      } else {
        elements = normalizeElements(elements);
      }

      const thumbnailBase64 = await generateThumbnail(elements, 400, 300, 2);
      
      const payload = {
        name: file.name.replace(/\.(json|excalidraw)$/i, ''),
        description: 'Uploaded from computer',
        tags: ['uploaded'],
        elements: elements,
        thumbnail: thumbnailBase64 
      };
      await axios.post('/api/libraries', payload, { withCredentials: true });
      fetchTemplates(debouncedSearch, 1);
      alert('Template uploaded successfully!');
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 401) {
        alert('Failed to upload: You are not authorized (please log in).');
      } else {
        const serverMsg = err.response?.data?.message;
        alert('Failed to upload template. Error: ' + (serverMsg || err.message || 'Unknown error'));
      }
    }
    e.target.value = ''; // Reset input
  };

  return (
    <div className="libraries-page">
      {/* ── Header ── */}
      <header className="libs-header">
        <div className="libs-header-left">
          <button className="libs-back-btn" onClick={() => navigate(-1)} title="Go back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="18" height="18">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <h1 className="libs-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="24" height="24" className="libs-title-icon">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Template Libraries
            </h1>
            <p className="libs-subtitle">Browse and import community templates for your whiteboard</p>
          </div>
        </div>
        
        <div className="libs-header-right">
          <input type="file" id="upload-template" style={{ display: 'none' }} onChange={handleFileUpload} />
          <label htmlFor="upload-template" className="libs-upload-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Template
          </label>
        </div>
      </header>

      {/* ── Search bar ── */}
      <div className="libs-search-bar">
        <div className="libs-search-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18" className="libs-search-icon">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search templates by name, description, or tags…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="libs-search-input"
          />
          {searchInput && (
            <button className="libs-search-clear" onClick={() => setSearchInput('')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
        <span className="libs-result-count">
          {loading ? 'Searching…' : `${total} template${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Template list ── */}
      <div className="libs-content">
        {loading ? (
          <div className="libs-loading">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="libs-skeleton-card">
                <div className="libs-skeleton-text" style={{ width: '60%', height: 24 }} />
                <div className="libs-skeleton-text" style={{ width: '30%', height: 16 }} />
                <div className="libs-skeleton-text" style={{ width: '80%', height: 14 }} />
                <div className="libs-skeleton-text" style={{ width: '45%', height: 14 }} />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="libs-empty">
            <span className="libs-empty-icon">📚</span>
            <h3>No templates found</h3>
            <p>{searchInput ? 'Try a different search term' : 'Be the first to upload a template!'}</p>
          </div>
        ) : (
          <div className="libs-list">
            {templates.map(t => (
              <div key={t._id} className="libs-card">
                <div className="libs-card-body">
                  <div className="libs-card-info">
                    <h2 className="libs-card-name">{t.name}</h2>
                    <span className="libs-card-author">@{t.authorName}</span>
                    <div className="libs-card-meta">
                      <span className="libs-card-downloads">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" fill="none" strokeWidth="2" /><polyline points="7 10 12 15 17 10" stroke="currentColor" fill="none" strokeWidth="2" /><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" fill="none" strokeWidth="2" /></svg>
                        {formatDownloads(t.downloads || 0)}
                      </span>
                      <span className="libs-card-date">Created: {formatDate(t.createdAt)}</span>
                    </div>
                    {t.description && <p className="libs-card-desc">{t.description}</p>}
                  </div>
                  {t.thumbnail && (
                    <div className="libs-card-preview">
                      <img src={t.thumbnail} alt={t.name} />
                    </div>
                  )}
                </div>
                <div className="libs-card-actions">
                  <button
                    className="libs-action-btn libs-action-import"
                    onClick={() => handleImport(t)}
                    disabled={importing === t._id}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    {importing === t._id ? 'Importing…' : 'Add to Canvas'}
                  </button>
                  <button
                    className="libs-action-btn libs-action-download"
                    onClick={() => handleDownload(t)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="libs-pagination">
            <button
              className="libs-page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← Previous
            </button>
            <span className="libs-page-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="libs-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
