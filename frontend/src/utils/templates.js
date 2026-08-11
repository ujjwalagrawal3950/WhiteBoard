import { v4 as uuid } from 'uuid';

export const getPlotMountainTemplate = () => {
  const gId = uuid();
  return [
    // ── BACKGROUND MOUNTAINS ──
    {
      id: uuid(), type: 'triangle', groupId: gId,
      x1: 200, y1: 850, x2: 600, y2: 300,
      strokeColor: 'transparent', fillColor: '#4a3633', opacity: 100
    },
    {
      id: uuid(), type: 'triangle', groupId: gId,
      x1: 600, y1: 300, x2: 1000, y2: 850,
      strokeColor: 'transparent', fillColor: '#59413d', opacity: 100
    },
    {
      id: uuid(), type: 'triangle', groupId: gId,
      x1: 450, y1: 850, x2: 700, y2: 450,
      strokeColor: 'transparent', fillColor: '#785f59', opacity: 100
    },
    {
      id: uuid(), type: 'triangle', groupId: gId,
      x1: 300, y1: 850, x2: 500, y2: 600,
      strokeColor: 'transparent', fillColor: '#634b46', opacity: 100
    },

    // ── MAIN TITLE ──
    {
      id: uuid(), type: 'text',
      x1: 600, y1: 50, x2: 600, y2: 80,
      strokeColor: '#2d2d2d', strokeWidth: 4, text: 'Brown Modern Plot Mountain Poster And Graphic Organizer',
      textAlign: 'center', opacity: 100
    },

    // ── OPENING ──
    {
      id: uuid(), type: 'text',
      x1: 250, y1: 600, x2: 250, y2: 630,
      strokeColor: '#34d399', strokeWidth: 4, text: 'OPENING',
      textAlign: 'center', opacity: 100
    },
    {
      id: uuid(), type: 'text',
      x1: 250, y1: 640, x2: 250, y2: 750,
      strokeColor: '#4b5563', strokeWidth: 2, text: 'WHO, WHEN and\nWHERE:\nSettings and\nCharacters',
      textAlign: 'center', opacity: 100
    },

    // ── BUILD UP ──
    {
      id: uuid(), type: 'text',
      x1: 400, y1: 350, x2: 400, y2: 380,
      strokeColor: '#34d399', strokeWidth: 4, text: 'BUILD UP',
      textAlign: 'center', opacity: 100
    },
    {
      id: uuid(), type: 'text',
      x1: 400, y1: 390, x2: 400, y2: 500,
      strokeColor: '#4b5563', strokeWidth: 2, text: 'Development of the\nproblem.\nSeries of events that\ndevelop interest\nand/or suspense.',
      textAlign: 'center', opacity: 100
    },

    // ── DILEMMA ──
    {
      id: uuid(), type: 'text',
      x1: 600, y1: 150, x2: 600, y2: 180,
      strokeColor: '#34d399', strokeWidth: 4, text: 'DILEMMA',
      textAlign: 'center', opacity: 100
    },
    {
      id: uuid(), type: 'text',
      x1: 600, y1: 190, x2: 600, y2: 260,
      strokeColor: '#4b5563', strokeWidth: 2, text: 'The turning point of\nthe story.\nThe problem reaches\nits peak.',
      textAlign: 'center', opacity: 100
    },

    // ── RESOLUTION ──
    {
      id: uuid(), type: 'text',
      x1: 800, y1: 350, x2: 800, y2: 380,
      strokeColor: '#34d399', strokeWidth: 4, text: 'RESOLUTION',
      textAlign: 'center', opacity: 100
    },
    {
      id: uuid(), type: 'text',
      x1: 800, y1: 390, x2: 800, y2: 460,
      strokeColor: '#4b5563', strokeWidth: 2, text: 'Events after the climax\nlead the characters to\nthe resolution.',
      textAlign: 'center', opacity: 100
    },

    // ── CLOSING ──
    {
      id: uuid(), type: 'text',
      x1: 950, y1: 600, x2: 950, y2: 630,
      strokeColor: '#34d399', strokeWidth: 4, text: 'CLOSING',
      textAlign: 'center', opacity: 100
    },
    {
      id: uuid(), type: 'text',
      x1: 950, y1: 640, x2: 950, y2: 750,
      strokeColor: '#4b5563', strokeWidth: 2, text: 'How the story ends.\nUsually when the\nresolution\nis presented to\nreaders.',
      textAlign: 'center', opacity: 100
    },

    // ── ARROWS ──
    {
      id: uuid(), type: 'arrow', strokeColor: '#dc2626', strokeWidth: 4,
      x1: 230, y1: 580, x2: 280, y2: 430, opacity: 100, lineStyle: 'solid'
    },
    {
      id: uuid(), type: 'arrow', strokeColor: '#dc2626', strokeWidth: 4,
      x1: 430, y1: 310, x2: 480, y2: 200, opacity: 100, lineStyle: 'solid'
    },
    {
      id: uuid(), type: 'arrow', strokeColor: '#dc2626', strokeWidth: 4,
      x1: 720, y1: 200, x2: 780, y2: 290, opacity: 100, lineStyle: 'solid'
    },
    {
      id: uuid(), type: 'arrow', strokeColor: '#dc2626', strokeWidth: 4,
      x1: 880, y1: 460, x2: 950, y2: 560, opacity: 100, lineStyle: 'solid'
    }
  ];
};
