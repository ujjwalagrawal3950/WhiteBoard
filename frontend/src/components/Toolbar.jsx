import { useDispatch, useSelector } from 'react-redux';
import { useRef } from 'react';
import { v4 as uuid } from 'uuid';
import {
  setTool, setStrokeColor, setFillColor, setStrokeWidth, setLineStyle, setOpacity,
  undo, redo, clearBoard, loadElements, addElement,
  groupSelected, ungroupSelected, deleteSelected, duplicateSelected,
  bringToFront, sendToBack,
  toggleGrid, setTextAlign, setCamera, setFontFamily, setFontSize, setSelectedIds, toggleTheme
} from '../store/boardSlice';
import { getPlotMountainTemplate } from '../utils/templates';

// ── Tool definitions ────────────────────────────────────────────────────────────
const DRAW_TOOLS = [
  { id: 'selection', label: 'Select', keys: 'S', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 3l4 12 3-5 5 3L5 3z" /></svg> },
  { id: 'hand', label: 'Pan', keys: 'H', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 13V4a2 2 0 0 1 4 0v9M13 13V7a2 2 0 0 1 4 0v6M17 13V9a2 2 0 0 1 4 0v9c0 4.4-3.6 8-8 8s-8-3.6-8-8V10a2 2 0 0 1 4 0v3"/></svg> },
  { id: 'pencil', label: 'Pencil', keys: 'P', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg> },
  { id: 'rectangle', label: 'Rectangle', keys: 'R', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2" /></svg> },
  { id: 'ellipse', label: 'Ellipse', keys: 'E', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="6" /></svg> },
  { id: 'diamond', label: 'Diamond', keys: 'D', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 22 12 12 22 2 12" /></svg> },
  { id: 'triangle', label: 'Triangle', keys: 'T', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 3 22 21 2 21" /></svg> },
  { id: 'line', label: 'Line', keys: 'L', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="19" x2="19" y2="5" /></svg> },
  { id: 'arrow', label: 'Arrow', keys: 'A', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="19" x2="19" y2="5" /><polyline points="9 5 19 5 19 15" /></svg> },
  { id: 'text', label: 'Text', keys: 'X', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg> },
  { id: 'sticky', label: 'Sticky', keys: 'N', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" /><polyline points="15 3 21 9 15 9 15 3" /></svg> },
  { id: 'image', label: 'Image', keys: 'I', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg> },
  { id: 'eraser', label: 'Eraser', keys: 'Q', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" opacity="0.5" /></svg> },
];

// ── Color palettes ──────────────────────────────────────────────────────────────
const STROKE_COLORS = [
  '#ffffff', // White
  '#3b82f6', // Neon Blue
  '#8b5cf6', // Neon Purple
  '#ec4899', // Neon Pink
  '#10b981', // Neon Green
];

const FILL_COLORS = [
  'transparent',
  'rgba(255,255,255,0.1)',
  'rgba(59,130,246,0.2)',
  'rgba(139,92,246,0.2)',
  'rgba(236,72,153,0.2)',
  'rgba(16,185,129,0.2)'
];

const STROKE_WIDTHS = [
  { value: 1, label: 'XS' },
  { value: 2, label: 'S' },
  { value: 4, label: 'M' },
  { value: 6, label: 'L' },
  { value: 10, label: 'XL' },
];

const LINE_STYLES = [
  { id: 'solid', label: 'Solid', render: '─────' },
  { id: 'dashed', label: 'Dashed', render: '- - -' },
  { id: 'dotted', label: 'Dotted', render: '· · ·' },
];

const TEXT_ALIGNS = [
  { id: 'left', label: 'Left', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg> },
  { id: 'center', label: 'Center', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg> },
  { id: 'right', label: 'Right', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg> },
];

const FONT_FAMILIES = [
  { id: 'Inter', label: 'Inter', category: 'Sans-Serif' },
  { id: 'Roboto', label: 'Roboto', category: 'Sans-Serif' },
  { id: 'Outfit', label: 'Outfit', category: 'Modern' },
  { id: 'Space Grotesk', label: 'Space Grotesk', category: 'Geometric' },
  { id: 'Playfair Display', label: 'Playfair Display', category: 'Serif' },
  { id: 'Space Mono', label: 'Space Mono', category: 'Monospace' },
  { id: 'Caveat', label: 'Caveat', category: 'Handwriting' },
  { id: 'Dancing Script', label: 'Dancing Script', category: 'Cursive' },
];

const FONT_SIZES = [
  { value: 16, label: 'S' },
  { value: 20, label: 'M' },
  { value: 28, label: 'L' },
  { value: 36, label: 'XL' },
];

function Section({ title, children }) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-title">{title}</div>
      {children}
    </div>
  );
}

function ColorSwatch({ color, active, onClick }) {
  const isTransparent = color === 'transparent';
  return (
    <button
      className={`color-swatch ${active ? 'swatch-active' : ''} ${isTransparent ? 'swatch-transparent' : ''}`}
      style={isTransparent ? {} : { background: color }}
      title={isTransparent ? 'No fill' : color}
      onClick={onClick}
    >
      {isTransparent && (
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="1" y1="13" x2="13" y2="1" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

export default function Toolbar() {
  const dispatch = useDispatch();
  const {
    tool, strokeColor, fillColor, strokeWidth, lineStyle, opacity, textAlign, fontFamily, fontSize, selectedIds, elements, showGrid, camera, theme
  } = useSelector(s => s.board);

  const fileInputRef = useRef(null);

  const hasSelection = selectedIds.length > 0;
  const canGroup = selectedIds.length >= 2;
  const canUngroup = selectedIds.length > 0 && elements.some(e => selectedIds.includes(e.id) && e.groupId);
  const showTextControls = tool === 'text' || elements.some(e => selectedIds.includes(e.id) && (e.type === 'text' || e.type === 'sticky'));
  
  // Show side panel only when needed
  const DRAWING_TOOLS = ['pencil', 'rectangle', 'ellipse', 'diamond', 'triangle', 'line', 'arrow', 'text', 'sticky'];
  const showSidePanel = DRAWING_TOOLS.includes(tool) || hasSelection;

  const handleClear = () => {
    if (window.confirm('Clear the entire board? This cannot be undone.')) dispatch(clearBoard());
  };

  const handleLoadTemplate = () => {
    if (window.confirm('Load Plot Mountain Template? This will replace your current board.')) {
      dispatch(loadElements(getPlotMountainTemplate()));
      dispatch(setCamera({ x: 0, y: 0, zoom: 0.8 }));
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const id = uuid();
      const img = new Image();
      img.onload = () => {
        // center the image around current camera pos
        const width = Math.min(img.width, 800);
        const height = img.height * (width / img.width);
        const cx = -camera.x + window.innerWidth / 2;
        const cy = -camera.y + window.innerHeight / 2;
        dispatch(addElement({
          id, type: 'image', x1: cx - width/2, y1: cy - height/2, x2: cx + width/2, y2: cy + height/2, src: dataUrl
        }));
        dispatch(setTool('selection'));
        dispatch(setSelectedIds([id]));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      {/* ── TOP TOOLBAR ── */}
      <div className="top-toolbar">
        <div className="tool-row">
          {DRAW_TOOLS.map(t => {
            if (t.id === 'image') {
              return (
                <button
                  key={t.id}
                  title={`${t.label} (${t.keys})`}
                  className="tool-btn-tb"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="tool-icon">{t.icon}</span>
                </button>
              );
            }
            return (
              <button
                key={t.id}
                title={`${t.label} (${t.keys})`}
                className={`tool-btn-tb ${tool === t.id ? 'tool-btn-tb-active' : ''}`}
                onClick={() => dispatch(setTool(t.id))}
              >
                <span className="tool-icon">{t.icon}</span>
              </button>
            );
          })}
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
          
          <div className="toolbar-separator" />
          
          <button className="tool-btn-tb" title="Undo (Ctrl+Z)" onClick={() => dispatch(undo())}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
          </button>
          <button className="tool-btn-tb" title="Redo (Ctrl+Y)" onClick={() => dispatch(redo())}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
          </button>
        </div>
      </div>

      {/* ── SIDE PROPERTIES PANEL ── */}
      <div className={`side-panel ${showSidePanel ? 'side-panel-visible' : ''}`}>
        {/* STROKE COLOR */}
        <Section title="Stroke Color">
          <div className="color-grid">
            {STROKE_COLORS.map(c => (
              <ColorSwatch key={c} color={c} active={strokeColor === c} onClick={() => dispatch(setStrokeColor(c))} />
            ))}
            <label className="color-swatch color-swatch-custom" title="Custom color">
              <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                <circle cx="8" cy="8" r="7" fill="url(#rainbowStroke)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <defs>
                  <linearGradient id="rainbowStroke" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="33%" stopColor="#fbbf24" />
                    <stop offset="66%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
              </svg>
              <input type="color" value={strokeColor} onChange={e => dispatch(setStrokeColor(e.target.value))} className="hidden-color-input" />
            </label>
          </div>
        </Section>

        {/* FILL COLOR */}
        <Section title="Fill Color">
          <div className="color-grid">
            {FILL_COLORS.map((c, i) => (
              <ColorSwatch key={i} color={c} active={fillColor === c} onClick={() => dispatch(setFillColor(c))} />
            ))}
            <label className="color-swatch color-swatch-custom" title="Custom fill">
              <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                <circle cx="8" cy="8" r="7" fill="url(#rainbowFill)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <defs>
                  <linearGradient id="rainbowFill" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f472b6" />
                    <stop offset="50%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>
              </svg>
              <input type="color" value={fillColor === 'transparent' ? '#7c3aed' : fillColor} onChange={e => dispatch(setFillColor(e.target.value))} className="hidden-color-input" />
            </label>
          </div>
        </Section>

        <div className="sidebar-divider" />

        {/* STROKE WIDTH */}
        <Section title="Stroke Width">
          <div className="stroke-width-row">
            {STROKE_WIDTHS.map(({ value, label }) => (
              <button
                key={value}
                title={`${label} (${value}px)`}
                className={`stroke-width-btn ${strokeWidth === value ? 'active' : ''}`}
                onClick={() => dispatch(setStrokeWidth(value))}
              >
                <div className="stroke-preview-line" style={{ height: Math.min(value * 2, 10) }} />
              </button>
            ))}
          </div>
        </Section>

        {/* LINE STYLE */}
        <Section title="Line Style">
          <div className="line-style-row">
            {LINE_STYLES.map(({ id, label, render }) => (
              <button
                key={id}
                title={label}
                className={`line-style-btn ${lineStyle === id ? 'active' : ''}`}
                onClick={() => dispatch(setLineStyle(id))}
              >
                <span className="line-style-preview" data-style={id}>{render}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* OPACITY */}
        <Section title={`Opacity — ${opacity}%`}>
          <div className="opacity-row">
            <input type="range" min={10} max={100} step={5} value={opacity} className="opacity-slider" onChange={e => dispatch(setOpacity(Number(e.target.value)))} />
          </div>
        </Section>

        {/* TEXT ALIGNMENT & FONT */}
        {showTextControls && (
          <>
            <Section title="Text Align">
              <div className="stroke-width-row">
                {TEXT_ALIGNS.map(({ id, label, icon }) => (
                  <button
                    key={id} title={label}
                    className={`stroke-width-btn ${textAlign === id ? 'active' : ''}`}
                    onClick={() => dispatch(setTextAlign(id))}
                  >
                    <span className="tool-icon" style={{ width: '18px', height: '18px' }}>{icon}</span>
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Font Size">
              <div className="stroke-width-row">
                {FONT_SIZES.map(({ value, label }) => (
                  <button
                    key={value} title={label}
                    className={`stroke-width-btn ${fontSize === value ? 'active' : ''}`}
                    onClick={() => dispatch(setFontSize(value))}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{label}</span>
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Font Family">
              <select className="font-family-select" value={fontFamily} onChange={e => dispatch(setFontFamily(e.target.value))}>
                {FONT_FAMILIES.map(({ id, label }) => (
                  <option key={id} value={id} style={{ fontFamily: id }}>{label}</option>
                ))}
              </select>
            </Section>
          </>
        )}

        {hasSelection && <div className="sidebar-divider" />}

        {/* SELECTION ACTIONS */}
        {hasSelection && (
          <Section title={`Selection (${selectedIds.length})`}>
            <div className="action-grid">
              {canGroup && (
                <button className="action-btn" onClick={() => dispatch(groupSelected())}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15"><rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" /><rect x="14" y="14" width="8" height="8" rx="1" /></svg>
                  Group
                </button>
              )}
              {canUngroup && (
                <button className="action-btn" onClick={() => dispatch(ungroupSelected())}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15"><path d="M4 4h4v4H4zM16 4h4v4h-4zM4 16h4v4H4zM16 16h4v4h-4zM8 8l8 8M16 8 8 16" /></svg>
                  Ungroup
                </button>
              )}
              <button className="action-btn" onClick={() => dispatch(bringToFront())}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15"><polyline points="18 15 12 9 6 15" /></svg>
                Bring Forward
              </button>
              <button className="action-btn" onClick={() => dispatch(sendToBack())}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15"><polyline points="6 9 12 15 18 9" /></svg>
                Send Backward
              </button>
              <button className="action-btn" onClick={() => dispatch(duplicateSelected())}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15"><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                Duplicate
              </button>
              <button className="action-btn action-btn-danger" onClick={() => dispatch(deleteSelected())}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                Delete
              </button>
            </div>
          </Section>
        )}

        <div className="sidebar-divider" />
        <Section title="Actions">
          <div className="action-grid">
            <button className="action-btn action-btn-danger" onClick={handleClear}>Clear</button>
            <button className="action-btn" onClick={handleLoadTemplate} style={{ color: '#34d399' }}>Template</button>
            <button className="action-btn" onClick={() => dispatch(toggleGrid())}>{showGrid ? 'Hide Grid' : 'Show Grid'}</button>
          </div>
        </Section>
      </div>
    </>
  );
}
