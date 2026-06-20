// Casino chip art with edge spots, inner ring and a denomination face.
type Ctx = CanvasRenderingContext2D;

export interface ChipStyle {
  body: string;
  bodyDark: string;
  edge: string;
}

// Denomination → colour, classic casino convention adapted to our palette.
export const CHIP_STYLES: { max: number; style: ChipStyle; label: string }[] = [
  { max: 5, label: 'red', style: { body: '#b5304a', bodyDark: '#7c1b2f', edge: '#f2e9d8' } },
  { max: 25, label: 'green', style: { body: '#2fa37c', bodyDark: '#196b51', edge: '#f2e9d8' } },
  { max: 100, label: 'walnut', style: { body: '#2a211a', bodyDark: '#120d09', edge: '#c9a24b' } },
  { max: 500, label: 'amber', style: { body: '#e8743b', bodyDark: '#a8481f', edge: '#fff0d8' } },
  { max: 1000, label: 'violet', style: { body: '#7d4fb0', bodyDark: '#4b2c70', edge: '#f2e9d8' } },
  { max: Infinity, label: 'gold', style: { body: '#c9a24b', bodyDark: '#8c6d2c', edge: '#fff6df' } },
];

export function chipStyleFor(value: number): ChipStyle {
  return (CHIP_STYLES.find((c) => value <= c.max) ?? CHIP_STYLES[CHIP_STYLES.length - 1]).style;
}

export function renderChip(style: ChipStyle, size = 96): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.04;
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, lighten(style.body));
  g.addColorStop(1, style.bodyDark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // edge spots
  ctx.fillStyle = style.edge;
  const spots = 8;
  for (let i = 0; i < spots; i++) {
    const a = (Math.PI * 2 * i) / spots;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
    ctx.rotate(a);
    rr(ctx, -r * 0.1, -r * 0.16, r * 0.2, r * 0.32, r * 0.05);
    ctx.fill();
    ctx.restore();
  }

  // inner disc
  ctx.fillStyle = style.body;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = size * 0.02;
  ctx.strokeStyle = style.edge;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // top gloss
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.35, r * 0.5, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 45);
  const g = Math.min(255, ((n >> 8) & 255) + 45);
  const b = Math.min(255, (n & 255) + 45);
  return `rgb(${r},${g},${b})`;
}
