// Custom slot-symbol art drawn to canvas. Every symbol has a gradient body,
// a top-left highlight and a drop shadow for a single consistent light source,
// so the set reads as a designed family rather than flat clip-art.

type Ctx = CanvasRenderingContext2D;

function withShadow(ctx: Ctx, fn: () => void) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;
  fn();
  ctx.restore();
}

function radial(ctx: Ctx, x: number, y: number, r: number, c0: string, c1: string) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

function circle(ctx: Ctx, x: number, y: number, r: number, c0: string, c1: string) {
  withShadow(ctx, () => {
    ctx.fillStyle = radial(ctx, x, y, r, c0, c1);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  // glossy highlight
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.32, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** A cut gem: faceted polygon with a bright crown and darker pavilion. */
function gem(ctx: Ctx, s: number, base: string, light: string, dark: string) {
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.34;
  withShadow(ctx, () => {
    ctx.fillStyle = radial(ctx, cx, cy, r, light, dark);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.95, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.6, cy + r);
    ctx.lineTo(cx - r * 0.6, cy + r);
    ctx.lineTo(cx - r * 0.95, cy - r * 0.25);
    ctx.closePath();
    ctx.fill();
  });
  // table facet
  ctx.fillStyle = light;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.45, cy - r * 0.25);
  ctx.lineTo(cx, cy + r * 0.1);
  ctx.lineTo(cx - r * 0.45, cy - r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // facet lines
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = Math.max(1, s * 0.006);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.45, cy - r * 0.25);
  ctx.lineTo(cx - r * 0.6, cy + r);
  ctx.moveTo(cx + r * 0.45, cy - r * 0.25);
  ctx.lineTo(cx + r * 0.6, cy + r);
  ctx.moveTo(cx, cy + r * 0.1);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  void base;
}

function star(ctx: Ctx, cx: number, cy: number, r: number, c0: string, c1: string, points = 5) {
  withShadow(ctx, () => {
    ctx.fillStyle = radial(ctx, cx, cy, r, c0, c1);
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const ang = (Math.PI / points) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fill();
  });
}

function roundTile(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const THEME_TILE: Record<string, [string, string, string]> = {
  fruit: ['#1c4636', '#0c2b1f', '#3da06f'],
  gems: ['#1a2740', '#0a1326', '#5b78c8'],
  egypt: ['#3a2a12', '#1c1306', '#caa24b'],
};

function tile(ctx: Ctx, s: number, theme: string) {
  const [c0, c1, edge] = THEME_TILE[theme] ?? THEME_TILE.gems;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  ctx.fillStyle = g;
  roundTile(ctx, s * 0.04, s * 0.04, s * 0.92, s * 0.92, s * 0.16);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, s * 0.018);
  ctx.strokeStyle = edge;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// --- emblem drawers (centered in size s) -----------------------------------
type Drawer = (ctx: Ctx, s: number) => void;

const DRAWERS: Record<string, Drawer> = {
  // shared specials
  wild: (ctx, s) => {
    // prism / rainbow gem
    gem(ctx, s, '#fff', '#fefefe', '#9aa6c8');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    const g = ctx.createLinearGradient(s * 0.2, 0, s * 0.8, s);
    g.addColorStop(0, '#ff5d6c');
    g.addColorStop(0.5, '#ffd15d');
    g.addColorStop(1, '#5db4ff');
    ctx.fillStyle = g;
    roundTile(ctx, s * 0.2, s * 0.2, s * 0.6, s * 0.6, s * 0.1);
    ctx.fill();
    ctx.restore();
    bannerText(ctx, s, 'WILD');
  },
  scatter: (ctx, s) => {
    star(ctx, s / 2, s * 0.45, s * 0.32, '#fff0b8', '#e8a23b');
    bannerText(ctx, s, 'SCATTER');
  },
  bonus: (ctx, s) => {
    // key
    withShadow(ctx, () => {
      ctx.fillStyle = radial(ctx, s / 2, s * 0.35, s * 0.18, '#f0d896', '#9a7a33');
      ctx.beginPath();
      ctx.arc(s / 2, s * 0.34, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c2b1f';
      ctx.beginPath();
      ctx.arc(s / 2, s * 0.34, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9a24b';
      ctx.fillRect(s * 0.47, s * 0.45, s * 0.06, s * 0.32);
      ctx.fillRect(s * 0.53, s * 0.62, s * 0.08, s * 0.05);
      ctx.fillRect(s * 0.53, s * 0.7, s * 0.08, s * 0.05);
    });
    bannerText(ctx, s, 'BONUS');
  },

  // fruit
  seven: (ctx, s) => {
    withShadow(ctx, () => {
      ctx.fillStyle = '#c9a24b';
      ctx.font = `800 ${s * 0.62}px "Playfair Display", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#6e5621';
      ctx.lineWidth = s * 0.02;
      ctx.strokeText('7', s / 2, s * 0.54);
      ctx.fillText('7', s / 2, s * 0.54);
    });
  },
  melon: (ctx, s) => {
    circle(ctx, s / 2, s / 2, s * 0.34, '#5fd07a', '#1f7a3e');
    ctx.strokeStyle = 'rgba(10,60,30,0.5)';
    ctx.lineWidth = s * 0.02;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(s / 2 + i * s * 0.12, s * 0.18);
      ctx.quadraticCurveTo(s / 2 + i * s * 0.16, s / 2, s / 2 + i * s * 0.12, s * 0.82);
      ctx.stroke();
    }
  },
  grape: (ctx, s) => {
    const pts = [[0.5, 0.32], [0.38, 0.45], [0.62, 0.45], [0.3, 0.6], [0.5, 0.6], [0.7, 0.6], [0.42, 0.75], [0.58, 0.75]];
    for (const [x, y] of pts) circle(ctx, s * x, s * y, s * 0.1, '#a06fd0', '#5b2f8a');
    ctx.strokeStyle = '#3a6b32';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.3);
    ctx.lineTo(s * 0.58, s * 0.18);
    ctx.stroke();
  },
  plum: (ctx, s) => {
    circle(ctx, s / 2, s * 0.54, s * 0.32, '#9a6fd0', '#46276f');
    ctx.strokeStyle = '#3a6b32';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(s * 0.52, s * 0.24);
    ctx.lineTo(s * 0.6, s * 0.14);
    ctx.stroke();
  },
  orange: (ctx, s) => {
    circle(ctx, s / 2, s * 0.54, s * 0.32, '#ffb24d', '#d8731f');
    ctx.fillStyle = '#3a6b32';
    ctx.beginPath();
    ctx.ellipse(s * 0.56, s * 0.24, s * 0.08, s * 0.04, -0.5, 0, Math.PI * 2);
    ctx.fill();
  },
  lemon: (ctx, s) => {
    withShadow(ctx, () => {
      ctx.fillStyle = radial(ctx, s / 2, s / 2, s * 0.34, '#fff07a', '#d9b21f');
      ctx.beginPath();
      ctx.ellipse(s / 2, s * 0.54, s * 0.34, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  cherry: (ctx, s) => {
    circle(ctx, s * 0.38, s * 0.66, s * 0.16, '#ff5d6c', '#a8112a');
    circle(ctx, s * 0.64, s * 0.7, s * 0.16, '#ff5d6c', '#a8112a');
    ctx.strokeStyle = '#3a6b32';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(s * 0.38, s * 0.52);
    ctx.quadraticCurveTo(s * 0.55, s * 0.2, s * 0.66, s * 0.24);
    ctx.moveTo(s * 0.64, s * 0.56);
    ctx.quadraticCurveTo(s * 0.6, s * 0.3, s * 0.66, s * 0.24);
    ctx.stroke();
  },

  // gems
  diamond: (ctx, s) => gem(ctx, s, '#dff1ff', '#ffffff', '#7fa8d8'),
  ruby: (ctx, s) => gem(ctx, s, '#ff5d6c', '#ff9aa6', '#9a0d28'),
  emerald: (ctx, s) => gem(ctx, s, '#3fd08a', '#a7f0c8', '#1a6e48'),
  sapphire: (ctx, s) => gem(ctx, s, '#5d8bff', '#a7c0ff', '#243a9a'),
  amethyst: (ctx, s) => gem(ctx, s, '#b07fe0', '#dcc0f5', '#5b2f8a'),
  topaz: (ctx, s) => gem(ctx, s, '#ffc14d', '#ffe1a0', '#b8791f'),
  opal: (ctx, s) => gem(ctx, s, '#cfe8e0', '#f0fff8', '#8fb8c8'),

  // egypt — silhouettes in gold
  anubis: (ctx, s) => glyphIcon(ctx, s, (c) => {
    // jackal head
    c.moveTo(s * 0.5, s * 0.2);
    c.lineTo(s * 0.38, s * 0.32);
    c.lineTo(s * 0.4, s * 0.5);
    c.lineTo(s * 0.34, s * 0.72);
    c.lineTo(s * 0.5, s * 0.8);
    c.lineTo(s * 0.66, s * 0.72);
    c.lineTo(s * 0.6, s * 0.5);
    c.lineTo(s * 0.62, s * 0.32);
    c.closePath();
    c.moveTo(s * 0.4, s * 0.32);
    c.lineTo(s * 0.34, s * 0.16);
    c.lineTo(s * 0.46, s * 0.28);
    c.moveTo(s * 0.6, s * 0.32);
    c.lineTo(s * 0.66, s * 0.16);
    c.lineTo(s * 0.54, s * 0.28);
  }),
  horus: (ctx, s) => glyphIcon(ctx, s, (c) => {
    // falcon head
    c.arc(s * 0.5, s * 0.45, s * 0.22, 0, Math.PI * 2);
    c.moveTo(s * 0.5, s * 0.5);
    c.lineTo(s * 0.74, s * 0.6);
    c.lineTo(s * 0.5, s * 0.62);
  }),
  cat: (ctx, s) => glyphIcon(ctx, s, (c) => {
    c.moveTo(s * 0.5, s * 0.78);
    c.lineTo(s * 0.4, s * 0.5);
    c.lineTo(s * 0.36, s * 0.28);
    c.lineTo(s * 0.46, s * 0.4);
    c.lineTo(s * 0.54, s * 0.4);
    c.lineTo(s * 0.64, s * 0.28);
    c.lineTo(s * 0.6, s * 0.5);
    c.closePath();
  }),
  eye: (ctx, s) => glyphIcon(ctx, s, (c) => {
    c.moveTo(s * 0.24, s * 0.46);
    c.quadraticCurveTo(s * 0.5, s * 0.26, s * 0.76, s * 0.46);
    c.quadraticCurveTo(s * 0.5, s * 0.62, s * 0.24, s * 0.46);
    c.moveTo(s * 0.5, s * 0.56);
    c.lineTo(s * 0.5, s * 0.72);
    c.lineTo(s * 0.4, s * 0.78);
  }),
  ankhg: (ctx, s) => glyphIcon(ctx, s, (c) => {
    c.arc(s * 0.5, s * 0.34, s * 0.12, 0, Math.PI * 2);
    c.moveTo(s * 0.46, s * 0.44);
    c.lineTo(s * 0.46, s * 0.8);
    c.lineTo(s * 0.54, s * 0.8);
    c.lineTo(s * 0.54, s * 0.44);
    c.moveTo(s * 0.3, s * 0.52);
    c.lineTo(s * 0.7, s * 0.52);
    c.lineTo(s * 0.7, s * 0.6);
    c.lineTo(s * 0.3, s * 0.6);
  }),
  scroll: (ctx, s) => glyphIcon(ctx, s, (c) => {
    c.rect(s * 0.28, s * 0.32, s * 0.44, s * 0.36);
    c.moveTo(s * 0.28, s * 0.32);
    c.arc(s * 0.28, s * 0.4, s * 0.08, 0, Math.PI * 2);
    c.moveTo(s * 0.72, s * 0.68);
    c.arc(s * 0.72, s * 0.6, s * 0.08, 0, Math.PI * 2);
  }),
  urn: (ctx, s) => glyphIcon(ctx, s, (c) => {
    c.moveTo(s * 0.4, s * 0.3);
    c.lineTo(s * 0.6, s * 0.3);
    c.lineTo(s * 0.66, s * 0.5);
    c.lineTo(s * 0.6, s * 0.78);
    c.lineTo(s * 0.4, s * 0.78);
    c.lineTo(s * 0.34, s * 0.5);
    c.closePath();
  }),
};

function bannerText(ctx: Ctx, s: number, text: string) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,5,0.8)';
  roundTile(ctx, s * 0.16, s * 0.74, s * 0.68, s * 0.16, s * 0.05);
  ctx.fill();
  ctx.fillStyle = '#f0d896';
  ctx.font = `800 ${s * 0.12}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, s / 2, s * 0.825);
  ctx.restore();
}

function glyphIcon(ctx: Ctx, s: number, path: (c: Ctx) => void) {
  withShadow(ctx, () => {
    ctx.fillStyle = ctx.createLinearGradient(0, s * 0.2, 0, s * 0.8);
    const g = ctx.fillStyle as CanvasGradient;
    g.addColorStop(0, '#f0d896');
    g.addColorStop(1, '#9a7a33');
    ctx.beginPath();
    path(ctx);
    ctx.fill();
  });
  ctx.strokeStyle = 'rgba(110,86,33,0.7)';
  ctx.lineWidth = Math.max(1, s * 0.01);
  ctx.beginPath();
  path(ctx);
  ctx.stroke();
}

export function renderSymbol(id: string, theme: string, size = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  tile(ctx, size, theme);
  const drawer = DRAWERS[id];
  if (drawer) drawer(ctx, size);
  else {
    ctx.fillStyle = '#f0d896';
    ctx.font = `800 ${size * 0.3}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id.slice(0, 3).toUpperCase(), size / 2, size / 2);
  }
  return canvas;
}
