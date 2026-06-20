// Custom playing-card art, drawn to canvas. No flat rectangles, no "letter in
// a box": real suit pips with proper layouts, ornamented court cards, and a
// gilded card back consistent with the app palette. These canvases are loaded
// into Phaser as textures and can be used in React too.

import type { Card } from '../engine-poker/cards';

const RED = '#B5304A';
const BLACK = '#21303a';
const FACE = '#F8F2E3';
const FACE_EDGE = '#E5D8BC';
const GOLD = '#C9A24B';
const GOLD_LT = '#E9CF8B';

export type SuitChar = 's' | 'h' | 'd' | 'c';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function suitColor(s: SuitChar) {
  return s === 'h' || s === 'd' ? RED : BLACK;
}

/** Draw a suit glyph centered at (cx,cy), spanning roughly `s` pixels tall. */
export function drawSuit(
  ctx: CanvasRenderingContext2D,
  suit: SuitChar,
  cx: number,
  cy: number,
  s: number,
  color: string,
  flip = false,
) {
  ctx.save();
  ctx.translate(cx, cy);
  if (flip) ctx.rotate(Math.PI);
  ctx.fillStyle = color;
  const u = s / 2;
  ctx.beginPath();
  switch (suit) {
    case 'h': {
      ctx.moveTo(0, u * 0.85);
      ctx.bezierCurveTo(u * 1.25, -u * 0.2, u * 0.55, -u * 1.1, 0, -u * 0.35);
      ctx.bezierCurveTo(-u * 0.55, -u * 1.1, -u * 1.25, -u * 0.2, 0, u * 0.85);
      ctx.closePath();
      break;
    }
    case 'd': {
      ctx.moveTo(0, -u);
      ctx.quadraticCurveTo(u * 0.18, -u * 0.18, u * 0.72, 0);
      ctx.quadraticCurveTo(u * 0.18, u * 0.18, 0, u);
      ctx.quadraticCurveTo(-u * 0.18, u * 0.18, -u * 0.72, 0);
      ctx.quadraticCurveTo(-u * 0.18, -u * 0.18, 0, -u);
      ctx.closePath();
      break;
    }
    case 's': {
      ctx.moveTo(0, -u);
      ctx.bezierCurveTo(u * 0.95, -u * 0.05, u * 0.7, u * 0.6, u * 0.12, u * 0.55);
      ctx.bezierCurveTo(u * 0.34, u * 0.75, u * 0.42, u * 0.9, u * 0.5, u * 1.02);
      ctx.lineTo(-u * 0.5, u * 1.02);
      ctx.bezierCurveTo(-u * 0.42, u * 0.9, -u * 0.34, u * 0.75, -u * 0.12, u * 0.55);
      ctx.bezierCurveTo(-u * 0.7, u * 0.6, -u * 0.95, -u * 0.05, 0, -u);
      ctx.closePath();
      break;
    }
    case 'c': {
      const r = u * 0.42;
      ctx.arc(0, -u * 0.45, r, 0, Math.PI * 2);
      ctx.moveTo(-u * 0.38 + r, u * 0.18);
      ctx.arc(-u * 0.42, u * 0.18, r, 0, Math.PI * 2);
      ctx.moveTo(u * 0.46 + r, u * 0.18);
      ctx.arc(u * 0.42, u * 0.18, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      // stem
      ctx.beginPath();
      ctx.moveTo(0, u * 0.05);
      ctx.quadraticCurveTo(u * 0.12, u * 0.7, u * 0.42, u * 1.02);
      ctx.lineTo(-u * 0.42, u * 1.02);
      ctx.quadraticCurveTo(-u * 0.12, u * 0.7, 0, u * 0.05);
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
  // subtle top highlight for depth
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, -u, 0, u);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-u * 1.3, -u * 1.3, u * 2.6, u * 2.6);
  ctx.restore();
}

const SUIT_GLYPH: Record<SuitChar, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

// Pip layouts as fractional (x,y) within the central area, per rank.
const PIPS: Record<string, [number, number][]> = {
  '2': [[0.5, 0.18], [0.5, 0.82]],
  '3': [[0.5, 0.18], [0.5, 0.5], [0.5, 0.82]],
  '4': [[0.27, 0.18], [0.73, 0.18], [0.27, 0.82], [0.73, 0.82]],
  '5': [[0.27, 0.18], [0.73, 0.18], [0.5, 0.5], [0.27, 0.82], [0.73, 0.82]],
  '6': [[0.27, 0.18], [0.73, 0.18], [0.27, 0.5], [0.73, 0.5], [0.27, 0.82], [0.73, 0.82]],
  '7': [[0.27, 0.18], [0.73, 0.18], [0.5, 0.34], [0.27, 0.5], [0.73, 0.5], [0.27, 0.82], [0.73, 0.82]],
  '8': [[0.27, 0.18], [0.73, 0.18], [0.5, 0.34], [0.27, 0.5], [0.73, 0.5], [0.5, 0.66], [0.27, 0.82], [0.73, 0.82]],
  '9': [[0.27, 0.16], [0.73, 0.16], [0.27, 0.39], [0.73, 0.39], [0.5, 0.5], [0.27, 0.61], [0.73, 0.61], [0.27, 0.84], [0.73, 0.84]],
  '10': [[0.27, 0.16], [0.73, 0.16], [0.5, 0.27], [0.27, 0.39], [0.73, 0.39], [0.27, 0.61], [0.73, 0.61], [0.5, 0.73], [0.27, 0.84], [0.73, 0.84]],
};

function cornerIndex(ctx: CanvasRenderingContext2D, rank: string, suit: SuitChar, w: number, h: number, color: string) {
  const fs = w * 0.165;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${fs}px "Zilla Slab", Georgia, serif`;
  const drawCorner = (x: number, y: number, flip: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.rotate(Math.PI);
    ctx.fillText(rank, 0, 0);
    drawSuit(ctx, suit, 0, fs * 0.78, fs * 0.62, color);
    ctx.restore();
  };
  drawCorner(w * 0.135, h * 0.115, false);
  drawCorner(w * 0.865, h * 0.885, true);
}

function drawCourt(ctx: CanvasRenderingContext2D, rank: string, suit: SuitChar, w: number, h: number, color: string) {
  const pad = w * 0.16;
  const fx = pad;
  const fy = h * 0.2;
  const fw = w - pad * 2;
  const fh = h * 0.6;
  // Ornate inner frame
  ctx.save();
  const grad = ctx.createLinearGradient(0, fy, 0, fy + fh);
  grad.addColorStop(0, '#fbf4e2');
  grad.addColorStop(1, '#efe2c4');
  ctx.fillStyle = grad;
  roundRect(ctx, fx, fy, fw, fh, w * 0.05);
  ctx.fill();
  ctx.lineWidth = Math.max(2, w * 0.012);
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.lineWidth = Math.max(1, w * 0.006);
  ctx.strokeStyle = color;
  roundRect(ctx, fx + w * 0.03, fy + w * 0.03, fw - w * 0.06, fh - w * 0.06, w * 0.04);
  ctx.stroke();

  // Crown for K/Q, plume for J — drawn in gold above the emblem.
  const cx = w / 2;
  ctx.fillStyle = GOLD;
  if (rank === 'K' || rank === 'Q') {
    const cw = fw * 0.46;
    const cy = fy + fh * 0.26;
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2, cy);
    ctx.lineTo(cx - cw / 2, cy - fh * 0.06);
    ctx.lineTo(cx - cw / 4, cy - fh * 0.01);
    ctx.lineTo(cx, cy - fh * 0.1);
    ctx.lineTo(cx + cw / 4, cy - fh * 0.01);
    ctx.lineTo(cx + cw / 2, cy - fh * 0.06);
    ctx.lineTo(cx + cw / 2, cy);
    ctx.closePath();
    ctx.fill();
    if (rank === 'Q') {
      ctx.beginPath();
      ctx.arc(cx, cy - fh * 0.12, fw * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Jack plume
    ctx.beginPath();
    ctx.ellipse(cx, fy + fh * 0.2, fw * 0.06, fh * 0.1, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Big central suit emblem
  drawSuit(ctx, suit, cx, fy + fh * 0.58, fh * 0.5, color);

  // Monogram
  ctx.fillStyle = color;
  ctx.font = `800 ${w * 0.16}px "Playfair Display", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rank, cx, fy + fh * 0.9);
  ctx.restore();
}

/** Render a full card face to a fresh canvas. */
export function renderCardFace(card: Card, width = 240, height = 336): HTMLCanvasElement {
  const rank = card[0] === 'T' ? '10' : card[0];
  const suit = card[1] as SuitChar;
  const color = suitColor(suit);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Card body
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, FACE);
  g.addColorStop(1, FACE_EDGE);
  ctx.fillStyle = g;
  roundRect(ctx, 2, 2, width - 4, height - 4, width * 0.075);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.stroke();

  cornerIndex(ctx, rank, suit, width, height, color);

  const cax = width * 0.22;
  const caw = width * 0.56;
  const cay = height * 0.1;
  const cah = height * 0.8;

  if (rank === 'A') {
    drawSuit(ctx, suit, width / 2, height / 2, height * 0.34, color);
    // gold ring flourish
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(2, width * 0.012);
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, height * 0.235, 0, Math.PI * 2);
    ctx.stroke();
  } else if (rank === 'J' || rank === 'Q' || rank === 'K') {
    drawCourt(ctx, rank, suit, width, height, color);
  } else {
    const pips = PIPS[rank] ?? [];
    const ps = width * 0.16;
    for (const [fxp, fyp] of pips) {
      const x = cax + fxp * caw;
      const y = cay + fyp * cah;
      drawSuit(ctx, suit, x, y, ps, color, fyp > 0.55);
    }
  }
  return canvas;
}

/** Render the gilded card back. */
export function renderCardBack(width = 240, height = 336): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, '#0f4a37');
  g.addColorStop(1, '#072a1e');
  ctx.fillStyle = g;
  roundRect(ctx, 2, 2, width - 4, height - 4, width * 0.075);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(2, width * 0.02);
  roundRect(ctx, width * 0.055, height * 0.04, width * 0.89, height * 0.92, width * 0.05);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, width * 0.008);
  ctx.strokeStyle = GOLD_LT;
  roundRect(ctx, width * 0.09, height * 0.065, width * 0.82, height * 0.87, width * 0.04);
  ctx.stroke();

  // Diagonal lattice
  ctx.save();
  roundRect(ctx, width * 0.09, height * 0.065, width * 0.82, height * 0.87, width * 0.04);
  ctx.clip();
  ctx.strokeStyle = 'rgba(201,162,75,0.28)';
  ctx.lineWidth = 1;
  const step = width * 0.1;
  for (let i = -height; i < width + height; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, height);
    ctx.lineTo(i + height, 0);
    ctx.stroke();
  }
  ctx.restore();

  // Center medallion with monogram "A"
  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.22;
  const mg = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
  mg.addColorStop(0, GOLD_LT);
  mg.addColorStop(1, '#8c6d2c');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b3d2e';
  ctx.font = `800 ${width * 0.26}px "Playfair Display", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', cx, cy + width * 0.01);
  return canvas;
}
