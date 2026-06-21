// HD poker-table surface art, drawn to canvas so it scales crisply and reads
// as a modern felt rather than a flat fill: layered radial light, a soft
// vignette, fine felt grain and a faint betting-line ring.

export function renderFelt(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  const ctx = c.getContext('2d')!;
  const cx = c.width / 2;
  const cy = c.height * 0.42;

  // Base radial light: brighter centre, deep edges.
  const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.05, cx, cy, Math.max(w, h) * 0.62);
  g.addColorStop(0, '#1b6149');
  g.addColorStop(0.5, '#0f4733');
  g.addColorStop(1, '#062117');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  // Vignette toward the rail.
  const v = ctx.createRadialGradient(cx, cy, Math.max(w, h) * 0.34, cx, cy, Math.max(w, h) * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, c.width, c.height);

  // Felt grain.
  ctx.globalAlpha = 0.05;
  const grain = 2;
  for (let y = 0; y < c.height; y += grain) {
    for (let x = 0; x < c.width; x += grain) {
      const n = Math.random();
      if (n > 0.5) {
        ctx.fillStyle = n > 0.75 ? '#ffffff' : '#000000';
        ctx.fillRect(x, y, grain, grain);
      }
    }
  }
  ctx.globalAlpha = 1;

  // Betting-line ring.
  ctx.strokeStyle = 'rgba(201,162,75,0.18)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.32, h * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();

  return c;
}
