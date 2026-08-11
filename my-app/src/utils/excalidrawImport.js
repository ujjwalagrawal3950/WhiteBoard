import { v4 as uuid } from 'uuid';

/**
 * Converts Excalidraw elements to SketchSync internal format
 * @param {Array} excalidrawElements - The elements array from an .excalidraw JSON file
 * @returns {Array} - The converted elements array
 */
export function convertExcalidrawElements(excalidrawElements) {
  if (!Array.isArray(excalidrawElements)) return [];

  const groupMap = {}; // Maps excalidraw group IDs to new SketchSync group IDs

  return excalidrawElements.map(ex => {
    // Determine internal type
    let internalType = ex.type;
    if (ex.type === 'freedraw') internalType = 'pencil';
    // Sketchsync uses 'rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'text' which match excalidraw exactly.

    // Base properties
    const el = {
      id: uuid(),
      type: internalType,
      x1: ex.x,
      y1: ex.y,
      x2: ex.x + (ex.width || 0),
      y2: ex.y + (ex.height || 0),
      strokeColor: ['#000000', '#1e1e1e', '#121212', '#202020'].includes(ex.strokeColor) ? '#ffffff' : (ex.strokeColor || '#ffffff'),
      fillColor: (ex.backgroundColor && ex.backgroundColor !== 'transparent') 
        ? (['#000000', '#1e1e1e', '#121212', '#202020'].includes(ex.backgroundColor) ? '#ffffff' : ex.backgroundColor) 
        : 'transparent',
      strokeWidth: ex.strokeWidth || 2,
      opacity: ex.opacity || 100,
      lineStyle: ex.strokeStyle === 'dashed' ? 'dashed' : ex.strokeStyle === 'dotted' ? 'dotted' : 'solid',
      angle: ex.angle || 0,
    };

    // Handle points for pencil, line, and arrow
    if (['pencil', 'line', 'arrow'].includes(internalType) && Array.isArray(ex.points)) {
      // Excalidraw points are relative to the top-left (x, y) of the element's bounding box.
      // SketchSync expects absolute points.
      const absPoints = ex.points.map(p => ({
        x: ex.x + p[0],
        y: ex.y + p[1],
      }));
      el.points = absPoints;
      
      // For line and arrow, SketchSync uses x1, y1, x2, y2 instead of points
      if (['line', 'arrow'].includes(internalType) && absPoints.length >= 2) {
         el.x1 = absPoints[0].x;
         el.y1 = absPoints[0].y;
         el.x2 = absPoints[absPoints.length - 1].x;
         el.y2 = absPoints[absPoints.length - 1].y;
      }
    }

    // Handle text specific properties
    if (internalType === 'text') {
      el.text = ex.text || '';
      el.textAlign = ex.textAlign || 'left';
      if (ex.fontSize) el.fontSize = ex.fontSize;
    }

    // Handle grouping
    // Excalidraw uses an array of groupIds (allowing nested groups).
    // SketchSync currently supports a single flat groupId. We'll map the first one.
    if (Array.isArray(ex.groupIds) && ex.groupIds.length > 0) {
      const exGroupId = ex.groupIds[0];
      if (!groupMap[exGroupId]) {
        groupMap[exGroupId] = `g_${uuid()}`;
      }
      el.groupId = groupMap[exGroupId];
    }

    return el;
  });
}
