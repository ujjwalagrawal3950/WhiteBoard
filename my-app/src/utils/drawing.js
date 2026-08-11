export function applyLineStyle(ctx, lineStyle, strokeWidth) {
  switch (lineStyle) {
    case 'dashed': ctx.setLineDash([strokeWidth * 5, strokeWidth * 3]); break;
    case 'dotted': ctx.setLineDash([strokeWidth * 1.5, strokeWidth * 3]); break;
    default: ctx.setLineDash([]); break;
  }
}

export function drawElement(ctx, element, isSelected = false, theme = 'dark', hideText = false) {
  const {
    type, x1, y1, x2 = x1, y2 = y1,
    strokeColor = '#ffffff',
    fillColor = 'transparent',
    strokeWidth = 2,
    lineStyle = 'solid',
    opacity = 100,
    text = '',
    points = [],
    angle = 0,
  } = element;

  let activeStroke = strokeColor;
  let activeFill = fillColor;
  
  if (theme === 'light') {
    if (activeStroke === '#ffffff') activeStroke = '#1e1e1e';
    if (activeFill === '#ffffff') activeFill = '#1e1e1e';
  } else {
    if (activeStroke === '#000000' || activeStroke === '#1e1e1e') activeStroke = '#ffffff';
    if (activeFill === '#000000' || activeFill === '#1e1e1e') activeFill = '#ffffff';
  }

  ctx.save();
  ctx.globalAlpha = opacity / 100;
  ctx.strokeStyle = activeStroke;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  applyLineStyle(ctx, lineStyle, strokeWidth);

  const hasFill = activeFill && activeFill !== 'transparent';
  if (hasFill) ctx.fillStyle = activeFill;

  let minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  let minY = Math.min(y1, y2), maxY = Math.max(y1, y2);

  if (points && points.length > 0) {
    minX = Math.min(...points.map(p => p.x));
    maxX = Math.max(...points.map(p => p.x));
    minY = Math.min(...points.map(p => p.y));
    maxY = Math.max(...points.map(p => p.y));
  }

  const w = maxX - minX, h = maxY - minY;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  if (angle) {
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.translate(-cx, -cy);
  }

  switch (type) {
    case 'rectangle': {
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(minX, minY, w, h, 4) : ctx.rect(minX, minY, w, h);
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'ellipse': {
      const rx = w / 2, ry = h / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'diamond': {
      ctx.beginPath();
      ctx.moveTo(cx, minY);
      ctx.lineTo(maxX, cy);
      ctx.lineTo(cx, maxY);
      ctx.lineTo(minX, cy);
      ctx.closePath();
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'triangle': {
      ctx.beginPath();
      ctx.moveTo(cx, minY);
      ctx.lineTo(maxX, maxY);
      ctx.lineTo(minX, maxY);
      ctx.closePath();
      if (hasFill) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'line': {
      ctx.beginPath();
      if (points && points.length >= 2) {
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      break;
    }
    case 'arrow': {
      ctx.beginPath();
      let lastX = x2, lastY = y2;
      let prevX = x1, prevY = y1;

      if (points && points.length >= 2) {
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        lastX = points[points.length - 1].x;
        lastY = points[points.length - 1].y;
        prevX = points[points.length - 2].x;
        prevY = points[points.length - 2].y;
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(lastY - prevY, lastX - prevX);
      const headLen = Math.max(14, strokeWidth * 5);
      ctx.setLineDash([]); // always solid arrowhead
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(lastX - headLen * Math.cos(angle - Math.PI / 6), lastY - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(lastX - headLen * Math.cos(angle + Math.PI / 6), lastY - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case 'pencil': {
      if (points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        // Smooth with quadratic curves
        if (i < points.length - 1) {
          const mx = (points[i].x + points[i + 1].x) / 2;
          const my = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
        } else {
          ctx.lineTo(points[i].x, points[i].y);
        }
      }
      ctx.stroke();
      break;
    }
    case 'text': {
      if (hideText) break;
      const lines = text.split('\n');
      const numLines = lines.length || 1;
      const hStr = Math.abs(y2 - y1) || 40;
      const fontSize = element.fontSize || Math.max(12, (hStr / numLines) * 0.75);
      const ff = element.fontFamily || 'Inter';
      ctx.font = `${fontSize}px '${ff}', Inter, system-ui, sans-serif`;
      ctx.fillStyle = activeStroke;
      ctx.setLineDash([]);
      ctx.textAlign = element.textAlign || 'left';
      ctx.textBaseline = 'top';

      let textX = x1;
      if (element.textAlign === 'center') textX = (x1 + (x2 || x1 + 200)) / 2;
      else if (element.textAlign === 'right') textX = x2 || x1 + 200;

      const lineH = fontSize * 1.2;
      lines.forEach((line, i) => {
        if (line) ctx.fillText(line, textX, Math.min(y1, y2) + i * lineH);
      });
      break;
    }
    case 'sticky': {
      // Draw sticky note background (a square)
      const cxSticky = (x1 + x2) / 2;
      const cySticky = (y1 + y2) / 2;
      const wSticky = Math.abs(x2 - x1);
      const hSticky = Math.abs(y2 - y1);
      const minXSticky = Math.min(x1, x2);
      const minYSticky = Math.min(y1, y2);

      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;

      ctx.fillStyle = fillColor || '#fef3c7'; // default pastel yellow
      ctx.globalAlpha = opacity / 100;
      ctx.fillRect(minXSticky, minYSticky, wSticky, hSticky);

      // Reset shadow for text
      ctx.shadowColor = 'transparent';

      // Draw text
      if (text && !hideText) {
        const fontSize = Math.max(12, hSticky * 0.12);
        const ff = element.fontFamily || 'Inter';
        ctx.font = `${fontSize}px '${ff}', Inter, system-ui, sans-serif`;
        ctx.fillStyle = strokeColor || '#1e293b'; // default dark text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = text.split('\n');
        const lineH = fontSize * 1.2;
        const totalH = lines.length * lineH;
        const startY = cySticky - totalH / 2 + lineH / 2;

        lines.forEach((line, i) => {
          if (line) ctx.fillText(line, cxSticky, startY + i * lineH);
        });
      }
      break;
    }
    case 'image': {
      if (element.src) {
        window._imgCache = window._imgCache || {};
        let img = window._imgCache[element.src];
        if (!img) {
          img = new Image();
          img.src = element.src;
          window._imgCache[element.src] = img;
        }
        if (img.complete && img.naturalWidth) {
          ctx.drawImage(img, minX, minY, w, h);
        }
      }
      if (isSelected) {
        ctx.strokeStyle = '#818cf8';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(minX, minY, w, h);
      }
      break;
    }
    default: break;
  }

  ctx.restore();
}

export function getBoundingBox(elements, ids) {
  const selected = elements.filter(e => ids.includes(e.id));
  if (selected.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selected.forEach(el => {
    const pts = el.points || [{ x: el.x1, y: el.y1 }, { x: el.x2 ?? el.x1, y: el.y2 ?? el.y1 }];
    pts.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    minX = Math.min(minX, el.x1, el.x2 ?? el.x1);
    minY = Math.min(minY, el.y1, el.y2 ?? el.y1);
    maxX = Math.max(maxX, el.x1, el.x2 ?? el.x1);
    maxY = Math.max(maxY, el.y1, el.y2 ?? el.y1);
  });
  return { minX, minY, maxX, maxY };
}

export async function generateThumbnail(elements, width = 300, height = 200, scale = 2) {
  return new Promise((resolve) => {
    if (!elements || elements.length === 0) return resolve('');

    // Bounding box of all elements
    const ids = elements.map(e => e.id);
    const bb = getBoundingBox(elements, ids);
    if (!bb) return resolve('');

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    
    // Transparent background so CSS theme background shows through
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scaling to fit elements in the canvas with some padding
    const padding = 20 * scale;
    const bbWidth = bb.maxX - bb.minX || 1;
    const bbHeight = bb.maxY - bb.minY || 1;
    
    const scaleX = (canvas.width - padding * 2) / bbWidth;
    const scaleY = (canvas.height - padding * 2) / bbHeight;
    const zoom = Math.min(scaleX, scaleY);
    
    // Center the bounding box in the canvas
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    const tx = canvas.width / 2 - cx * zoom;
    const ty = canvas.height / 2 - cy * zoom;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(zoom, zoom);

    // Draw elements using current theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    elements.forEach(el => drawElement(ctx, el, false, currentTheme));
    
    ctx.restore();

    // Check if any images need to load (if there are image elements)
    const hasImages = elements.some(e => e.type === 'image');
    if (hasImages) {
        // Wait a tiny bit for images to decode just in case they were cached but not drawn
        setTimeout(() => resolve(canvas.toDataURL('image/png')), 50);
    } else {
        resolve(canvas.toDataURL('image/png'));
    }
  });
}
