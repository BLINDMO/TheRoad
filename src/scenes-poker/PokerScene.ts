import Phaser from 'phaser';
import { pokerBus, type PokerView, type PokerSeatView } from '../lib/eventBus';
import { cardTexture, cardBackTexture, CARD_RATIO } from './cardTextures';
import { renderChip } from '../assets/chipArt';

// The poker table surface. React stays out of this canvas; the scene consumes
// typed events from pokerBus and renders an HD felt, modern player pods, cards,
// chips, the dealer button and win celebrations. Layout adapts to portrait or
// landscape so the table fills the screen either way.

const BRASS = 0xc9a24b;

interface SeatObjs {
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  avatar: Phaser.GameObjects.Container;
  nameText: Phaser.GameObjects.Text;
  stackText: Phaser.GameObjects.Text;
  cardSprites: Phaser.GameObjects.Image[];
  betChip: Phaser.GameObjects.Image | null;
  betText: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Container | null;
  bubble: Phaser.GameObjects.Container | null;
  lastCardsKey: string;
  lastAction?: string;
  glowTween?: Phaser.Tweens.Tween;
}

export class PokerScene extends Phaser.Scene {
  private seatObjs = new Map<number, SeatObjs>();
  private boardSprites: Phaser.GameObjects.Image[] = [];
  private potText!: Phaser.GameObjects.Text;
  private potChip!: Phaser.GameObjects.Image;
  private msgText!: Phaser.GameObjects.Text;
  private dealerBtn!: Phaser.GameObjects.Container;
  private centerX = 0;
  private centerY = 0;
  private tableW = 0;
  private tableH = 0;
  private landscape = false;
  private offState!: () => void;
  private offWin!: () => void;
  private offBoard!: () => void;
  private currentView?: PokerView;

  constructor() {
    super('PokerScene');
  }

  create() {
    this.buildTable();
    this.makeChipTextures();

    this.potChip = this.add.image(0, 0, 'chip-walnut').setScale(0.42).setDepth(6).setVisible(false);
    this.potText = this.add.text(0, 0, '', {
      fontFamily: 'Zilla Slab, serif', fontSize: '22px', color: '#F2E9D8', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);
    this.msgText = this.add.text(this.centerX, this.centerY - this.tableH * 0.34, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#E4C878',
    }).setOrigin(0.5).setDepth(6).setAlpha(0.92);
    this.layoutPot();

    this.dealerBtn = this.makeDealerButton();

    this.offState = pokerBus.on('state', (v) => {
      this.registry.set('pokerView', v);
      this.renderView(v);
    });
    this.offBoard = pokerBus.on('deal-board', ({ cards }) => this.renderBoard(cards, true));
    this.offWin = pokerBus.on('win', (w) => this.celebrate(w));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.scale.on('resize', this.onResize, this);

    pokerBus.emit('scene-ready', undefined);
    const cached = (this.registry.get('pokerView') as PokerView | undefined) ?? this.currentView;
    if (cached) this.renderView(cached);
  }

  private resizeTimer?: Phaser.Time.TimerEvent;
  private onResize() {
    this.resizeTimer?.remove();
    this.resizeTimer = this.time.delayedCall(180, () => {
      if (this.scene.isActive()) this.scene.restart();
    });
  }

  private cleanup() {
    this.offState?.();
    this.offWin?.();
    this.offBoard?.();
    this.scale.off('resize', this.onResize, this);
    this.seatObjs.clear();
    this.boardSprites = [];
  }

  private layoutPot() {
    const y = this.centerY + this.tableH * 0.30;
    this.potChip.setPosition(this.centerX - 30, y);
    this.potText.setPosition(this.centerX + 6, y);
    this.msgText.setPosition(this.centerX, this.centerY - this.tableH * 0.40);
  }

  private buildTable() {
    const { width, height } = this.scale;
    this.landscape = width >= height;
    this.centerX = width / 2;
    this.centerY = height * (this.landscape ? 0.44 : 0.40);
    this.tableW = this.landscape ? width * 0.76 : width * 0.92;
    this.tableH = this.landscape ? height * 0.66 : height * 0.5;

    const cx = this.centerX;
    const cy = this.centerY;
    const w = this.tableW;
    const h = this.tableH;

    // Rail (layered) drawn beneath the felt so it reads as a polished rim.
    const rail = this.add.graphics().setDepth(-2);
    rail.fillStyle(0x140f0a, 1);
    rail.fillEllipse(cx, cy, w + 54, h + 54);
    rail.fillStyle(0x2a211a, 1);
    rail.fillEllipse(cx, cy, w + 34, h + 34);
    rail.lineStyle(3, BRASS, 0.85);
    rail.strokeEllipse(cx, cy, w + 30, h + 30);
    rail.lineStyle(1, 0xe4c878, 0.5);
    rail.strokeEllipse(cx, cy, w + 8, h + 8);

    // Felt — many concentric ellipses interpolate edge→core for a smooth radial
    // gradient (no textures/masks, which keeps WebGL happy on every device).
    const felt = this.add.graphics().setDepth(-1);
    const edge = { r: 0x06, g: 0x21, b: 0x17 };
    const core = { r: 0x1d, g: 0x67, b: 0x4d };
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = i / N; // 0 = outer edge, 1 = centre
      const col = lerpColor(edge, core, t);
      felt.fillStyle(col, 1);
      felt.fillEllipse(cx, cy - h * 0.05 * t, w * (1 - t * 0.9), h * (1 - t * 0.9));
    }
    // Soft centre sheen + rail vignette + betting line.
    felt.fillStyle(0x2a7a5d, 0.18); felt.fillEllipse(cx, cy - h * 0.08, w * 0.34, h * 0.28);
    felt.lineStyle(Math.max(8, h * 0.07), 0x041b12, 0.4); felt.strokeEllipse(cx, cy, w * 0.98, h * 0.96);
    felt.lineStyle(Math.max(1.5, w * 0.0035), BRASS, 0.18); felt.strokeEllipse(cx, cy, w * 0.6, h * 0.6);

    // Brand monogram, subtle.
    this.add.text(cx, cy - h * 0.12, 'GILDED ACES', {
      fontFamily: 'Playfair Display, serif', fontSize: this.landscape ? '22px' : '18px',
      color: '#0c3a2a', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.5).setDepth(-1);
  }

  private makeChipTextures() {
    for (const label of ['red', 'green', 'walnut', 'amber', 'violet', 'gold']) {
      const key = `chip-${label}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, renderChip(chipStyleForLabel(label), 96));
    }
  }

  private makeDealerButton(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const disc = this.add.circle(0, 0, 13, 0xf6efdd).setStrokeStyle(2, 0x8c6d2c);
    const t = this.add.text(0, 0, 'D', {
      fontFamily: 'Zilla Slab, serif', fontSize: '15px', color: '#1a1410', fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([disc, t]);
    c.setDepth(20).setVisible(false);
    return c;
  }

  // Hero anchored bottom-centre; others spread clockwise around the oval.
  private seatPosition(displayIndex: number, total: number): { x: number; y: number } {
    const a = Math.PI / 2 + (displayIndex / total) * Math.PI * 2;
    const rx = this.tableW * 0.56;
    const ry = this.tableH * 0.58;
    return { x: this.centerX + Math.cos(a) * rx, y: this.centerY + Math.sin(a) * ry };
  }

  private renderView(v: PokerView) {
    this.currentView = v;
    if (!this.scene.isActive()) return;
    const total = v.seats.length;
    const heroIdx = v.seats.findIndex((s) => s.isHuman);
    const order = (i: number) => (i - heroIdx + total) % total;

    for (const seat of v.seats) {
      const pos = this.seatPosition(order(seat.seat), total);
      this.renderSeat(seat, pos);
      if (seat.isButton) {
        this.dealerBtn.setVisible(true).setDepth(20);
        const bx = pos.x + (this.centerX - pos.x) * 0.22;
        const by = pos.y + (this.centerY - pos.y) * 0.22;
        this.tweens.add({ targets: this.dealerBtn, x: bx, y: by, duration: 250, ease: 'Quad.out' });
      }
    }
    for (const [idx, objs] of this.seatObjs) {
      if (!v.seats.some((s) => s.seat === idx)) {
        objs.container.destroy();
        objs.betChip?.destroy();
        objs.betText.destroy();
        objs.badge?.destroy();
        this.seatObjs.delete(idx);
      }
    }

    this.renderBoard(v.board, false);
    this.potChip.setVisible(v.pot > 0);
    this.potText.setText(v.pot > 0 ? v.pot.toLocaleString() : '');
    this.msgText.setText(v.message ?? '');
  }

  private getSeatObjs(seat: PokerSeatView, pos: { x: number; y: number }): SeatObjs {
    let o = this.seatObjs.get(seat.seat);
    if (o) return o;

    const PW = this.landscape ? 130 : 110;
    const PH = 50;
    const container = this.add.container(pos.x, pos.y).setDepth(12);

    const glow = this.add.graphics();
    const plate = this.add.graphics();
    this.drawPlate(plate, PW, PH, false);

    const avatar = this.makeAvatar(seat, -PW / 2 + 28);
    const nameText = this.add.text(-PW / 2 + 54, -10, seat.name, {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#F2E9D8', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const stackText = this.add.text(-PW / 2 + 54, 12, '', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#E4C878',
    }).setOrigin(0, 0.5);

    container.add([glow, plate, avatar, nameText, stackText]);
    container.setData('pw', PW).setData('ph', PH);

    const betText = this.add.text(pos.x, pos.y, '', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#F2E9D8', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(15);

    o = {
      container, plate, glow, avatar, nameText, stackText,
      cardSprites: [], betChip: null, betText, badge: null, bubble: null, lastCardsKey: '',
    };
    this.seatObjs.set(seat.seat, o);
    return o;
  }

  private drawPlate(g: Phaser.GameObjects.Graphics, w: number, h: number, active: boolean) {
    g.clear();
    g.fillStyle(0x221a12, 0.96);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillStyle(0x140f0a, 0.55);
    g.fillRoundedRect(-w / 2, h * 0.1, w, h * 0.4, 12);
    g.lineStyle(1, 0xffffff, 0.06);
    g.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 11);
    g.lineStyle(active ? 2 : 1.5, active ? 0xe8743b : BRASS, active ? 1 : 0.5);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  }

  private makeAvatar(seat: PokerSeatView, x: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, 0);
    const hue = avatarHue(seat.name + seat.id);
    const col = Phaser.Display.Color.HSVToRGB(hue / 360, 0.55, 0.5) as Phaser.Types.Display.ColorObject;
    const dark = Phaser.Display.Color.HSVToRGB(hue / 360, 0.6, 0.3) as Phaser.Types.Display.ColorObject;
    const ring = this.add.circle(0, 0, 23, Phaser.Display.Color.GetColor(dark.r, dark.g, dark.b)).setStrokeStyle(2, BRASS, 0.75);
    const disc = this.add.circle(0, 0, 20, Phaser.Display.Color.GetColor(col.r, col.g, col.b));
    const letter = this.add.text(0, 0, seat.name.slice(0, 1).toUpperCase(), {
      fontFamily: 'Playfair Display, serif', fontSize: '21px', color: '#F8F2E3', fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([ring, disc, letter]);
    return c;
  }

  private renderSeat(seat: PokerSeatView, pos: { x: number; y: number }) {
    const o = this.getSeatObjs(seat, pos);
    o.container.setPosition(pos.x, pos.y);
    o.container.setAlpha(seat.folded ? 0.4 : 1);
    o.nameText.setText(seat.name);
    o.stackText.setText(seat.allIn ? 'ALL IN' : seat.stack.toLocaleString());
    o.stackText.setColor(seat.allIn ? '#F49A6B' : '#E4C878');

    const PW = o.container.getData('pw') as number;
    const PH = o.container.getData('ph') as number;
    this.drawPlate(o.plate, PW, PH, seat.isActing);

    // Active glow ring around the pod.
    if (seat.isActing) {
      o.glow.clear();
      o.glow.lineStyle(3, 0xe8743b, 0.9);
      o.glow.strokeRoundedRect(-PW / 2 - 3, -PH / 2 - 3, PW + 6, PH + 6, 12);
      if (!o.glowTween) {
        o.glowTween = this.tweens.add({ targets: o.glow, alpha: 0.25, yoyo: true, repeat: -1, duration: 600 });
      }
    } else {
      o.glow.clear();
      o.glowTween?.remove();
      o.glowTween = undefined;
      o.glow.setAlpha(1);
    }

    this.renderSeatCards(seat, pos, o);
    this.renderBet(seat, pos, o);
    this.renderBadge(seat, pos, o);

    const actionChanged = seat.lastAction !== o.lastAction;
    o.lastAction = seat.lastAction;
    this.renderBubble(seat, pos, o, actionChanged);
  }

  private renderBet(seat: PokerSeatView, pos: { x: number; y: number }, o: SeatObjs) {
    if (seat.bet > 0) {
      const bx = pos.x + (this.centerX - pos.x) * 0.34;
      const by = pos.y + (this.centerY - pos.y) * 0.34;
      if (!o.betChip) o.betChip = this.add.image(pos.x, pos.y, `chip-${chipLabelFor(seat.bet)}`).setScale(0.3).setDepth(14);
      o.betChip.setTexture(`chip-${chipLabelFor(seat.bet)}`).setVisible(true);
      this.tweens.add({ targets: o.betChip, x: bx, y: by - 12, duration: 220, ease: 'Quad.out' });
      o.betText.setText(seat.bet.toLocaleString()).setVisible(true).setPosition(bx + 14, by - 12);
    } else {
      o.betChip?.setVisible(false);
      o.betText.setVisible(false);
    }
  }

  private renderBadge(seat: PokerSeatView, pos: { x: number; y: number }, o: SeatObjs) {
    const PW = o.container.getData('pw') as number;
    if (seat.status) {
      if (!o.badge) {
        const c = this.add.container(0, 0).setDepth(16);
        const bg = this.add.circle(0, 0, 10, 0x0b3d2e).setStrokeStyle(1.5, BRASS);
        const t = this.add.text(0, 0, seat.status, { fontFamily: 'Inter', fontSize: '9px', color: '#E4C878', fontStyle: 'bold' }).setOrigin(0.5);
        c.add([bg, t]);
        o.badge = c;
      }
      (o.badge.list[1] as Phaser.GameObjects.Text).setText(seat.status);
      o.badge.setPosition(pos.x + PW / 2 - 6, pos.y - 22).setVisible(true);
    } else {
      o.badge?.setVisible(false);
    }
  }

  private renderBubble(seat: PokerSeatView, pos: { x: number; y: number }, o: SeatObjs, actionChanged: boolean) {
    const chat = seat.bubble;
    const actionLabel = actionChanged && seat.lastAction && !seat.folded ? labelAction(seat.lastAction) : '';
    const text = chat || actionLabel;
    if (!text) return;
    o.bubble?.destroy();
    const c = this.add.container(pos.x, pos.y - 40).setDepth(18);
    const t = this.add.text(0, 0, text, { fontFamily: 'Inter', fontSize: '11px', color: '#1a1410', fontStyle: 'bold' }).setOrigin(0.5);
    const bg = this.add.rectangle(0, 0, t.width + 16, t.height + 8, 0xf2e9d8, 1).setStrokeStyle(1, BRASS).setOrigin(0.5);
    c.add([bg, t]);
    c.setScale(0.6);
    this.tweens.add({ targets: c, scale: 1, duration: 150, ease: 'Back.out' });
    o.bubble = c;
    this.time.delayedCall(1400, () => { if (o.bubble === c) { c.destroy(); o.bubble = null; } });
  }

  private renderSeatCards(seat: PokerSeatView, pos: { x: number; y: number }, o: SeatObjs) {
    const key = seat.cards.join(',') + '|' + (seat.showCards ? 'f' : seat.folded ? 'x' : 'b') + (seat.isHuman ? 'h' : '');
    if (key === o.lastCardsKey) return;
    o.lastCardsKey = key;
    o.cardSprites.forEach((s) => s.destroy());
    o.cardSprites = [];
    if (seat.folded) return;

    const cw = seat.isHuman ? (this.landscape ? 86 : 64) : 42;
    const ch = cw * CARD_RATIO;
    const toward = Math.sign(this.centerY - pos.y) || -1;
    const cy = pos.y + (seat.isHuman ? -ch * 0.5 - 8 : toward * 18);
    const showFaces = seat.showCards && seat.cards.length > 0;
    for (let i = 0; i < 2; i++) {
      const card = seat.cards[i];
      const texKey = showFaces && card ? cardTexture(this, card) : cardBackTexture(this);
      const x = pos.x + (i - 0.5) * (cw * 0.6);
      const sprite = this.add.image(this.centerX, this.centerY, texKey)
        .setDisplaySize(cw, ch).setDepth(11).setAngle((i - 0.5) * 7);
      o.cardSprites.push(sprite);
      this.tweens.add({ targets: sprite, x, y: cy, duration: 320, delay: i * 80, ease: 'Cubic.out' });
    }
  }

  private renderBoard(cards: string[], animate: boolean) {
    const cw = Math.min(this.landscape ? 74 : 60, this.tableW * 0.12);
    const ch = cw * CARD_RATIO;
    const gap = cw * 1.14;
    const startX = this.centerX - (gap * 4) / 2;
    const y = this.centerY + this.tableH * 0.02;

    for (let i = 0; i < cards.length; i++) {
      if (this.boardSprites[i]) {
        this.boardSprites[i].setPosition(startX + i * gap, y).setDisplaySize(cw, ch);
        continue;
      }
      const tex = cardTexture(this, cards[i]);
      const sprite = this.add.image(animate ? this.centerX : startX + i * gap, y, tex).setDisplaySize(cw, ch).setDepth(8);
      this.boardSprites[i] = sprite;
      if (animate) {
        sprite.setScale(0).setAngle(-18);
        this.tweens.add({
          targets: sprite, x: startX + i * gap, displayWidth: cw, displayHeight: ch,
          scaleX: 1, scaleY: 1, angle: 0, duration: 360, delay: i * 90, ease: 'Back.out',
        });
      }
    }
    if (cards.length < this.boardSprites.length) {
      this.boardSprites.forEach((s) => s?.destroy());
      this.boardSprites = [];
    }
  }

  private celebrate({ seat, amount, big }: { seat: number; amount: number; big: boolean }) {
    const view = this.currentView;
    if (!view) return;
    const total = view.seats.length;
    const heroIdx = view.seats.findIndex((s) => s.isHuman);
    const order = (i: number) => (i - heroIdx + total) % total;
    const pos = this.seatPosition(order(seat), total);

    const count = big ? 18 : 8;
    for (let i = 0; i < count; i++) {
      const chip = this.add.image(this.centerX, this.centerY + this.tableH * 0.28, 'chip-gold').setScale(0.3).setDepth(30);
      this.tweens.add({
        targets: chip, x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + (Math.random() - 0.5) * 22,
        duration: 420 + Math.random() * 200, delay: i * 26, ease: 'Cubic.out', onComplete: () => chip.destroy(),
      });
    }
    const win = this.add.text(pos.x, pos.y - 36, `+${amount.toLocaleString()}`, {
      fontFamily: 'Zilla Slab, serif', fontSize: big ? '28px' : '19px', color: '#FFB37A', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(40).setScale(0.4);
    this.tweens.add({ targets: win, scale: 1, y: pos.y - 58, duration: 480, ease: 'Back.out' });
    this.tweens.add({ targets: win, alpha: 0, delay: 1300, duration: 500, onComplete: () => win.destroy() });
    if (big) this.bigBurst();
  }

  private bigBurst() {
    const colors = [0xc9a24b, 0xe8743b, 0xf2e9d8, 0xe4c878];
    for (let i = 0; i < 44; i++) {
      const p = this.add.rectangle(this.centerX, this.centerY, 6, 10, colors[i % colors.length]).setDepth(35);
      const ang = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 180;
      this.tweens.add({
        targets: p, x: this.centerX + Math.cos(ang) * dist, y: this.centerY + Math.sin(ang) * dist + 50,
        angle: Math.random() * 360, alpha: 0, duration: 900 + Math.random() * 500, ease: 'Cubic.out',
        onComplete: () => p.destroy(),
      });
    }
  }
}

function lerpColor(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number): number {
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return (r << 16) | (g << 8) | bl;
}

function avatarHue(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

function chipLabelFor(value: number): string {
  if (value <= 5) return 'red';
  if (value <= 25) return 'green';
  if (value <= 100) return 'walnut';
  if (value <= 500) return 'amber';
  if (value <= 1000) return 'violet';
  return 'gold';
}
function chipStyleForLabel(label: string) {
  const bodies: Record<string, { body: string; bodyDark: string; edge: string }> = {
    red: { body: '#b5304a', bodyDark: '#7c1b2f', edge: '#f2e9d8' },
    green: { body: '#2fa37c', bodyDark: '#196b51', edge: '#f2e9d8' },
    walnut: { body: '#2a211a', bodyDark: '#120d09', edge: '#c9a24b' },
    amber: { body: '#e8743b', bodyDark: '#a8481f', edge: '#fff0d8' },
    violet: { body: '#7d4fb0', bodyDark: '#4b2c70', edge: '#f2e9d8' },
    gold: { body: '#c9a24b', bodyDark: '#8c6d2c', edge: '#fff6df' },
  };
  return bodies[label];
}
function labelAction(a: string): string {
  switch (a) {
    case 'fold': return 'Fold';
    case 'check': return 'Check';
    case 'call': return 'Call';
    case 'bet': return 'Bet';
    case 'raise': return 'Raise';
    case 'all-in': return 'All In';
    case 'post-blind': return 'Blind';
    default: return '';
  }
}
