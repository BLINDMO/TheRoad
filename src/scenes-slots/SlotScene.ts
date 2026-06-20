import Phaser from 'phaser';
import { slotBus } from '../lib/eventBus';
import type { MachineConfig, SpinResult } from '../engine-slots/types';
import { renderSymbol } from '../assets/symbolArt';

// One reusable reel-rig engine that drives every machine skin. The machine
// config (symbols, theme, paylines) arrives via the bus; the scene only renders
// and animates — reel spin-up, hold, anticipation wobble and decelerated stop,
// then win-line highlighting. React owns the math and the feature flow.

const REELS = 5;
const ROWS = 3;

export class SlotScene extends Phaser.Scene {
  private cfg?: MachineConfig;
  private cells: Phaser.GameObjects.Image[][] = []; // [reel][row]
  private cellSize = 64;
  private originX = 0;
  private originY = 0;
  private reelStopTimers: Phaser.Time.TimerEvent[] = [];
  private spinningReels = new Set<number>();
  private lineGfx!: Phaser.GameObjects.Graphics;
  private frameGfx!: Phaser.GameObjects.Graphics;
  private offSpin!: () => void;
  private offMachine!: () => void;
  private symbolKeys = new Map<string, string>();

  constructor() {
    super('SlotScene');
  }

  create() {
    this.frameGfx = this.add.graphics();
    this.lineGfx = this.add.graphics().setDepth(20);
    this.offMachine = slotBus.on('set-machine', (cfg) => this.setupMachine(cfg));
    this.offSpin = slotBus.on('spin', ({ result, freeSpin }) => this.runSpin(result, freeSpin));
    this.scale.on('resize', this.onResize, this);
    slotBus.emit('scene-ready', undefined);
  }

  shutdown() {
    this.offSpin?.();
    this.offMachine?.();
    this.scale.off('resize', this.onResize, this);
  }

  private onResize() {
    if (this.cfg) {
      this.layout();
      this.redrawFrame();
    }
  }

  private symbolTexture(id: string): string {
    let key = this.symbolKeys.get(id);
    if (!key) {
      key = `sym-${this.cfg!.id}-${id}`;
      if (!this.textures.exists(key)) {
        this.textures.addCanvas(key, renderSymbol(id, this.cfg!.theme, 128));
      }
      this.symbolKeys.set(id, key);
    }
    return key;
  }

  private setupMachine(cfg: MachineConfig) {
    this.cfg = cfg;
    this.symbolKeys.clear();
    this.cells.forEach((col) => col.forEach((c) => c.destroy()));
    this.cells = [];
    this.layout();
    // Seed an initial random board.
    for (let r = 0; r < REELS; r++) {
      this.cells[r] = [];
      for (let row = 0; row < ROWS; row++) {
        const id = this.randomSymbol();
        const img = this.add.image(0, 0, this.symbolTexture(id)).setData('id', id).setDepth(5);
        this.cells[r][row] = img;
      }
    }
    this.layout();
    this.redrawFrame();
  }

  private layout() {
    if (!this.cfg) return;
    const { width, height } = this.scale;
    const margin = width * 0.04;
    const usableW = width - margin * 2;
    this.cellSize = Math.min(usableW / REELS, (height * 0.6) / ROWS);
    const gridW = this.cellSize * REELS;
    const gridH = this.cellSize * ROWS;
    this.originX = (width - gridW) / 2 + this.cellSize / 2;
    this.originY = (height - gridH) / 2 + this.cellSize / 2;
    for (let r = 0; r < this.cells.length; r++) {
      for (let row = 0; row < ROWS; row++) {
        const img = this.cells[r]?.[row];
        if (!img) continue;
        img.setPosition(this.originX + r * this.cellSize, this.originY + row * this.cellSize);
        img.setDisplaySize(this.cellSize * 0.92, this.cellSize * 0.92);
      }
    }
  }

  private redrawFrame() {
    const g = this.frameGfx;
    g.clear();
    const gridW = this.cellSize * REELS;
    const gridH = this.cellSize * ROWS;
    const x = this.originX - this.cellSize / 2;
    const y = this.originY - this.cellSize / 2;
    // reel wells
    g.fillStyle(0x0a0712, 1);
    g.fillRoundedRect(x - 10, y - 10, gridW + 20, gridH + 20, 16);
    for (let r = 0; r < REELS; r++) {
      g.fillStyle(r % 2 ? 0x0c0a1a : 0x100c20, 1);
      g.fillRoundedRect(x + r * this.cellSize + 2, y + 2, this.cellSize - 4, gridH - 4, 8);
    }
    // brass frame
    g.lineStyle(3, 0xc9a24b, 0.9);
    g.strokeRoundedRect(x - 10, y - 10, gridW + 20, gridH + 20, 16);
  }

  private randomSymbol(): string {
    const strip = this.cfg!.reelStrips[0];
    return strip[Math.floor(Math.random() * strip.length)].id;
  }

  private runSpin(result: SpinResult, _freeSpin: boolean) {
    if (!this.cfg) return;
    this.lineGfx.clear();
    this.spinningReels = new Set([0, 1, 2, 3, 4]);
    this.reelStopTimers.forEach((t) => t.remove());
    this.reelStopTimers = [];

    // Detect anticipation: if 2 scatters already, slow the later reels.
    const scatterId = this.cfg.scatterId;
    const targetScatters = result.grid.flat().filter((id) => id === scatterId).length;

    for (let r = 0; r < REELS; r++) {
      this.startReelBlur(r);
      // Anticipation when scatter could still complete a trigger on later reels.
      const earlyScatter = countScatterUpTo(result.grid, scatterId, r);
      const anticipate = r >= 2 && earlyScatter >= 2 && targetScatters >= 2;
      const stopDelay = 420 + r * 240 + (anticipate ? 900 : 0);
      const t = this.time.delayedCall(stopDelay, () => {
        if (anticipate) this.flashReel(r);
        this.stopReel(r, result.grid[r]);
        if (r === REELS - 1) {
          this.time.delayedCall(120, () => this.afterStop(result));
        }
      });
      this.reelStopTimers.push(t);
    }
  }

  private startReelBlur(reel: number) {
    const col = this.cells[reel];
    const timer = this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        if (!this.spinningReels.has(reel)) { timer.remove(); return; }
        for (const cell of col) {
          const id = this.randomSymbol();
          cell.setTexture(this.symbolTexture(id)).setData('id', id);
        }
        // motion: squash vertically
        col.forEach((c) => c.setScale(c.scaleX, c.scaleY)); // keep size via displaySize
      },
    });
    // vertical jitter for motion feel
    col.forEach((c) => {
      this.tweens.add({ targets: c, y: c.y + 6, yoyo: true, repeat: -1, duration: 60, ease: 'Sine.inOut' });
    });
  }

  private stopReel(reel: number, columnIds: string[]) {
    this.spinningReels.delete(reel);
    const col = this.cells[reel];
    this.tweens.killTweensOf(col);
    for (let row = 0; row < ROWS; row++) {
      const id = columnIds[row];
      const cell = col[row];
      cell.setTexture(this.symbolTexture(id)).setData('id', id);
      const baseY = this.originY + row * this.cellSize;
      cell.setPosition(this.originX + reel * this.cellSize, baseY - 18);
      this.tweens.add({
        targets: cell, y: baseY, duration: 260, ease: 'Bounce.out',
      });
      cell.setDisplaySize(this.cellSize * 0.92, this.cellSize * 0.92);
    }
    // emit a stop sound hook via global (handled in React through bus? keep simple)
    this.events.emit('reelstop');
  }

  private flashReel(reel: number) {
    const x = this.originX + reel * this.cellSize - this.cellSize / 2;
    const y = this.originY - this.cellSize / 2;
    const glow = this.add.rectangle(x + this.cellSize / 2, y + (this.cellSize * ROWS) / 2,
      this.cellSize, this.cellSize * ROWS, 0xe8743b, 0.0).setDepth(15);
    this.tweens.add({ targets: glow, fillAlpha: 0.3, yoyo: true, repeat: 3, duration: 200,
      onComplete: () => glow.destroy() });
  }

  private afterStop(result: SpinResult) {
    slotBus.emit('reels-stopped', { result });
    this.highlightWins(result);
  }

  private highlightWins(result: SpinResult) {
    if (!this.cfg) return;
    const g = this.lineGfx;
    g.clear();
    const colors = [0xe8743b, 0x2fa37c, 0xc9a24b, 0x5d8bff, 0xb07fe0];
    result.lineWins.forEach((w, i) => {
      const line = this.cfg!.paylines[w.line];
      g.lineStyle(4, colors[i % colors.length], 0.9);
      g.beginPath();
      for (let r = 0; r < REELS; r++) {
        const x = this.originX + r * this.cellSize;
        const y = this.originY + line[r] * this.cellSize;
        if (r === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
      // pulse winning cells
      for (let r = 0; r < w.count; r++) {
        const cell = this.cells[r][line[r]];
        this.tweens.add({ targets: cell, scale: cell.scale * 1.12, yoyo: true, repeat: 2, duration: 200 });
      }
    });
    // scatter pulse
    if (result.scatterCount >= 3 && this.cfg.scatterId) {
      this.cells.forEach((col) => col.forEach((c) => {
        if (c.getData('id') === this.cfg!.scatterId) {
          this.tweens.add({ targets: c, scale: c.scale * 1.2, yoyo: true, repeat: 3, duration: 220 });
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
