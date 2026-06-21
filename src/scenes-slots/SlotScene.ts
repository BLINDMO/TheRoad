import Phaser from 'phaser';
import { slotBus } from '../lib/eventBus';
import type { MachineConfig, SpinResult } from '../engine-slots/types';
import { renderSymbol } from '../assets/symbolArt';

// One reusable reel-rig engine that drives every machine skin. The machine
// config (symbols, theme, paylines) arrives via the bus; the scene renders and
// animates real scrolling reels — spin-up, hold, anticipation and a decelerated
// bounce stop — then highlights winning lines. React owns the math and features.

const REELS = 5;
const ROWS = 3;
const BUFFER = 2; // extra sprites above/below the visible window for scrolling

interface Reel {
  sprites: Phaser.GameObjects.Image[]; // top -> bottom, length ROWS + BUFFER
  scroll: number;
  spinning: boolean;
  speed: number;
  x: number;
}

export class SlotScene extends Phaser.Scene {
  private cfg?: MachineConfig;
  private reels: Reel[] = [];
  private faceCells: Phaser.GameObjects.Image[][] = []; // [reel][row] after a stop
  private cellSize = 64;
  private gridX = 0; // left edge of grid
  private gridY = 0; // top edge of grid
  private lineGfx!: Phaser.GameObjects.Graphics;
  private frameGfx!: Phaser.GameObjects.Graphics;
  private maskGfx!: Phaser.GameObjects.Graphics;
  private offSpin!: () => void;
  private offMachine!: () => void;
  private symbolKeys = new Map<string, string>();
  private pendingResult?: SpinResult;
  private stopOrder: { reel: number; at: number }[] = [];
  private spinClock = 0;

  constructor() {
    super('SlotScene');
  }

  create() {
    this.frameGfx = this.add.graphics().setDepth(2);
    this.maskGfx = this.add.graphics().setVisible(false);
    this.lineGfx = this.add.graphics().setDepth(20);

    this.offMachine = slotBus.on('set-machine', (cfg) => this.setupMachine(cfg));
    this.offSpin = slotBus.on('spin', ({ result }) => this.runSpin(result));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.scale.on('resize', this.onResize, this);

    slotBus.emit('scene-ready', undefined);
    const cached = this.registry.get('slotMachine') as MachineConfig | undefined;
    if (cached) this.setupMachine(cached);
  }

  private cleanup() {
    this.offSpin?.();
    this.offMachine?.();
    this.scale.off('resize', this.onResize, this);
    this.reels = [];
    this.faceCells = [];
  }

  private onResize() {
    if (this.cfg) {
      this.layout();
      this.drawFrame();
    }
  }

  private symbolTexture(id: string): string {
    let key = this.symbolKeys.get(id);
    if (!key) {
      key = `sym-${this.cfg!.id}-${id}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, renderSymbol(id, this.cfg!.theme, 128));
      this.symbolKeys.set(id, key);
    }
    return key;
  }

  private setupMachine(cfg: MachineConfig) {
    this.cfg = cfg;
    this.registry.set('slotMachine', cfg);
    this.symbolKeys.clear();
    this.reels.forEach((r) => r.sprites.forEach((s) => s.destroy()));
    this.reels = [];
    this.faceCells = [];

    this.computeLayout();
    for (let r = 0; r < REELS; r++) {
      const sprites: Phaser.GameObjects.Image[] = [];
      for (let i = 0; i < ROWS + BUFFER; i++) {
        const id = this.randomSymbol();
        sprites.push(this.add.image(0, 0, this.symbolTexture(id)).setData('id', id).setDepth(5));
      }
      this.reels.push({ sprites, scroll: 0, spinning: false, speed: 0, x: 0 });
      this.faceCells[r] = sprites.slice(BUFFER / 2, BUFFER / 2 + ROWS);
    }
    this.layout();
    this.drawFrame();
    this.applyMask();
  }

  private computeLayout() {
    const { width, height } = this.scale;
    const margin = width * 0.05;
    const usableW = width - margin * 2;
    this.cellSize = Math.min(usableW / REELS, (height * 0.62) / ROWS);
    const gridW = this.cellSize * REELS;
    const gridH = this.cellSize * ROWS;
    this.gridX = (width - gridW) / 2;
    this.gridY = (height - gridH) / 2;
  }

  private layout() {
    this.computeLayout();
    for (let r = 0; r < REELS; r++) {
      const reel = this.reels[r];
      if (!reel) continue;
      reel.x = this.gridX + r * this.cellSize + this.cellSize / 2;
      this.positionReel(r);
    }
  }

  /** Place a reel's sprites at their resting positions, offset by scroll. */
  private positionReel(r: number) {
    const reel = this.reels[r];
    const half = BUFFER / 2;
    for (let i = 0; i < reel.sprites.length; i++) {
      const sp = reel.sprites[i];
      const baseY = this.gridY + (i - half) * this.cellSize + this.cellSize / 2;
      sp.setPosition(reel.x, baseY + reel.scroll);
      sp.setDisplaySize(this.cellSize * 0.9, this.cellSize * 0.9);
    }
  }

  private drawFrame() {
    const g = this.frameGfx;
    g.clear();
    const gridW = this.cellSize * REELS;
    const gridH = this.cellSize * ROWS;
    const x = this.gridX;
    const y = this.gridY;
    g.fillStyle(0x080611, 1);
    g.fillRoundedRect(x - 12, y - 12, gridW + 24, gridH + 24, 18);
    for (let r = 0; r < REELS; r++) {
      g.fillStyle(r % 2 ? 0x0d0a1c : 0x120e24, 1);
      g.fillRoundedRect(x + r * this.cellSize + 2, y + 2, this.cellSize - 4, gridH - 4, 8);
    }
    g.lineStyle(4, 0xc9a24b, 0.95);
    g.strokeRoundedRect(x - 12, y - 12, gridW + 24, gridH + 24, 18);
    g.lineStyle(1, 0xe4c878, 0.4);
    g.strokeRoundedRect(x - 6, y - 6, gridW + 12, gridH + 12, 14);
  }

  private applyMask() {
    const g = this.maskGfx;
    g.clear();
    g.fillStyle(0xffffff);
    g.fillRect(this.gridX, this.gridY, this.cellSize * REELS, this.cellSize * ROWS);
    const mask = g.createGeometryMask();
    this.reels.forEach((reel) => reel.sprites.forEach((s) => s.setMask(mask)));
  }

  private randomSymbol(): string {
    const strip = this.cfg!.reelStrips[0];
    return strip[Math.floor(Math.random() * strip.length)].id;
  }

  private runSpin(result: SpinResult) {
    if (!this.cfg) return;
    this.lineGfx.clear();
    this.pendingResult = result;
    this.spinClock = 0;

    const scatterId = this.cfg.scatterId;
    const targetScatters = result.grid.flat().filter((id) => id === scatterId).length;

    this.stopOrder = [];
    for (let r = 0; r < REELS; r++) {
      const reel = this.reels[r];
      reel.spinning = true;
      reel.speed = this.cellSize * (22 + r * 2); // px/sec, slightly faster on later reels
      const earlyScatter = countScatterUpTo(result.grid, scatterId, r);
      const anticipate = r >= 2 && earlyScatter >= 2 && targetScatters >= 2;
      const at = 450 + r * 280 + (anticipate ? 1100 : 0);
      this.stopOrder.push({ reel: r, at });
      if (anticipate) this.flashReel(r);
    }
  }

  update(_time: number, delta: number) {
    if (!this.cfg) return;
    const anySpinning = this.reels.some((r) => r.spinning);
    if (!anySpinning) return;
    this.spinClock += delta;
    const dt = delta / 1000;

    for (let r = 0; r < REELS; r++) {
      const reel = this.reels[r];
      if (!reel.spinning) continue;

      reel.scroll += reel.speed * dt;
      // Recycle sprites that scrolled a full cell past the bottom.
      while (reel.scroll >= this.cellSize) {
        reel.scroll -= this.cellSize;
        const last = reel.sprites.pop()!;
        const id = this.randomSymbol();
        last.setTexture(this.symbolTexture(id)).setData('id', id);
        reel.sprites.unshift(last);
      }
      this.positionReel(r);

      const stop = this.stopOrder.find((s) => s.reel === r);
      if (stop && this.spinClock >= stop.at) {
        this.stopReel(r);
      }
    }
  }

  private stopReel(r: number) {
    const reel = this.reels[r];
    reel.spinning = false;
    reel.scroll = 0;
    const result = this.pendingResult!;
    const col = result.grid[r];
    const half = BUFFER / 2;

    // Assign final symbols: visible window = target column, buffers = random.
    for (let i = 0; i < reel.sprites.length; i++) {
      const sp = reel.sprites[i];
      const rowIdx = i - half;
      const id = rowIdx >= 0 && rowIdx < ROWS ? col[rowIdx] : this.randomSymbol();
      sp.setTexture(this.symbolTexture(id)).setData('id', id);
    }
    this.faceCells[r] = reel.sprites.slice(half, half + ROWS);
    this.positionReel(r);

    // Bounce-in the landing.
    for (let row = 0; row < ROWS; row++) {
      const sp = this.faceCells[r][row];
      const baseY = sp.y;
      sp.y = baseY - 22;
      this.tweens.add({ targets: sp, y: baseY, duration: 280, ease: 'Bounce.out' });
    }

    if (this.reels.every((rr) => !rr.spinning)) {
      this.time.delayedCall(120, () => this.afterStop(result));
    }
  }

  private flashReel(reel: number) {
    const x = this.gridX + reel * this.cellSize;
    const glow = this.add.rectangle(
      x + this.cellSize / 2, this.gridY + (this.cellSize * ROWS) / 2,
      this.cellSize, this.cellSize * ROWS, 0xe8743b, 0,
    ).setDepth(15);
    this.tweens.add({ targets: glow, fillAlpha: 0.32, yoyo: true, repeat: 4, duration: 220, onComplete: () => glow.destroy() });
  }

  private afterStop(result: SpinResult) {
    slotBus.emit('reels-stopped', { result });
    this.highlightWins(result);
  }

  private highlightWins(result: SpinResult) {
    if (!this.cfg) return;
    const g = this.lineGfx;
    g.clear();
    const colors = [0xe8743b, 0x2fa37c, 0xc9a24b, 0x5d8bff, 0xb07fe0, 0xff5d6c];
    result.lineWins.forEach((w, i) => {
      const line = this.cfg!.paylines[w.line];
      g.lineStyle(4, colors[i % colors.length], 0.92);
      g.beginPath();
      for (let r = 0; r < REELS; r++) {
        const x = this.gridX + r * this.cellSize + this.cellSize / 2;
        const y = this.gridY + line[r] * this.cellSize + this.cellSize / 2;
        if (r === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
      for (let r = 0; r < w.count; r++) {
        const cell = this.faceCells[r]?.[line[r]];
        if (cell) this.tweens.add({ targets: cell, scaleX: cell.scaleX * 1.12, scaleY: cell.scaleY * 1.12, yoyo: true, repeat: 2, duration: 200 });
      }
    });
    if (result.scatterCount >= 3 && this.cfg.scatterId) {
      this.faceCells.forEach((col) => col.forEach((c) => {
        if (c.getData('id') === this.cfg!.scatterId) {
          this.tweens.add({ targets: c, scaleX: c.scaleX * 1.2, scaleY: c.scaleY * 1.2, yoyo: true, repeat: 3, duration: 220 });
        }
      }));
    }
  }
}

function countScatterUpTo(grid: string[][], scatterId: string | undefined, reelExclusive: number): number {
  if (!scatterId) return 0;
  let c = 0;
  for (let r = 0; r < reelExclusive; r++) for (const id of grid[r]) if (id === scatterId) c++;
  return c;
}
