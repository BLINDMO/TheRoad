import Phaser from 'phaser';
import { pokerBus, type PokerView, type PokerSeatView } from '../lib/eventBus';
import { cardTexture, cardBackTexture, CARD_RATIO } from './cardTextures';
import { chipStyleFor, renderChip } from '../assets/chipArt';

// The poker table surface. React stays out of this canvas; the scene only
// consumes typed events from pokerBus and renders felt, seats, cards, chips,
// the dealer button and win celebrations.

const FELT = 0x0b3d2e;
const FELT_LIGHT = 0x13513d;
const RAIL = 0x1a1410;
const BRASS = 0xc9a24b;
const CREAM = 0xf2e9d8;

interface SeatObjs {
  container: Phaser.GameObjects.Container;
  cardSprites: Phaser.GameObjects.Image[];
  betText: Phaser.GameObjects.Text;
  betChip: Phaser.GameObjects.Image | null;
  stackText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  ring: Phaser.GameObjects.Arc;
  avatar: Phaser.GameObjects.Container;
  actGlow: Phaser.GameObjects.Arc;
  bubble: Phaser.GameObjects.Container | null;
  lastCardsKey: string;
  lastAction?: string;
  badge: Phaser.GameObjects.Container | null;
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

    this.potChip = this.add.image(this.centerX - 38, this.centerY + this.tableH * 0.12, 'chip-walnut')
      .setScale(0.5).setVisible(false);
    this.potText = this.add.text(this.centerX, this.centerY + this.tableH * 0.12, '', {
      fontFamily: 'Zilla Slab, serif', fontSize: '26px', color: '#F2E9D8', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.msgText = this.add.text(this.centerX, this.centerY - this.tableH * 0.02, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#C9A24B',
    }).setOrigin(0.5).setAlpha(0.9);

    this.dealerBtn = this.makeDealerButton();

    this.offState = pokerBus.on('state', (v) => {
      // Cache in the game registry so a scene restart (e.g. on rotate) can
      // immediately re-render the current table instead of going blank.
      this.registry.set('pokerView', v);
      this.renderView(v);
    });
    this.offBoard = pokerBus.on('deal-board', ({ cards }) => this.renderBoard(cards, true));
    this.offWin = pokerBus.on('win', (w) => this.celebrate(w));

    // Clean up bus listeners whenever the scene shuts down or restarts.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.scale.on('resize', this.onResize, this);

    pokerBus.emit('scene-ready', undefined);

    // Render whatever the controller last published (survives restarts).
    const cached = (this.registry.get('pokerView') as PokerView | undefined) ?? this.currentView;
    if (cached) this.renderView(cached);
  }

  private resizeTimer?: Phaser.Time.TimerEvent;
  private onResize() {
    // Debounce: rotation/URL-bar resizes can fire rapidly. Rebuild once it settles.
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

  private buildTable() {
    const { width, height } = this.scale;
    this.centerX = width / 2;
    // Lift the table so the bottom (hero) seat clears the action bar, and the
    // top seats clear the HUD strip.
    this.centerY = height * 0.42;
    this.tableW = width * 0.9;
    this.tableH = height * 0.54;

    const g = this.add.graphics();
    // Rail
    g.fillStyle(RAIL, 1);
    g.fillEllipse(this.centerX, this.centerY, this.tableW + 34, this.tableH + 34);
    // Brass trim
    g.lineStyle(3, BRASS, 0.8);
    g.strokeEllipse(this.centerX, this.centerY, this.tableW + 14, this.tableH + 14);
    // Felt
    g.fillStyle(FELT, 1);
    g.fillEllipse(this.centerX, this.centerY, this.tableW, this.tableH);
    g.fillStyle(FELT_LIGHT, 0.5);
    g.fillEllipse(this.centerX, this.centerY - this.tableH * 0.08, this.tableW * 0.7, this.tableH * 0.42);
    g.lineStyle(2, 0x0a3327, 1);
    g.strokeEllipse(this.centerX, this.centerY, this.tableW * 0.74, this.tableH * 0.5);

    // Center monogram
    this.add.text(this.centerX, this.centerY - this.tableH * 0.16, 'GILDED ACES', {
      fontFamily: 'Playfair Display, serif', fontSize: '20px', color: '#0a3327', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.55);
  }

  private makeChipTextures() {
    for (const label of ['red', 'green', 'walnut', 'amber', 'violet', 'gold']) {
      const key = `chip-${label}`;
      if (!this.textures.exists(key)) {
        const styleEntry = chipStyleForLabel(label);
        this.textures.addCanvas(key, renderChip(styleEntry, 96));
      }
    }
  }

  private makeDealerButton(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const disc = this.add.circle(0, 0, 14, 0xf2e9d8).setStrokeStyle(2, 0x8c6d2c);
    const t = this.add.text(0, 0, 'D', {
      fontFamily: 'Zilla Slab, serif', fontSize: '16px', color: '#1a1410', fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([disc, t]);
    c.setDepth(20).setVisible(false);
    return c;
  }

  // --- seat geometry: hero at bottom, others around the oval ---------------
  private seatPosition(displayIndex: number, total: number): { x: number; y: number } {
    // displayIndex 0 = hero (bottom center), going clockwise.
    const angleStart = Math.PI / 2; // bottom
    const a = angleStart + (displayIndex / total) * Math.PI * 2;
    const rx = this.tableW * 0.52;
    const ry = this.tableH * 0.56;
    return { x: this.centerX + Math.cos(a) * rx, y: this.centerY + Math.sin(a) * ry };
  }

  private renderView(v: PokerView) {
    this.currentView = v;
    if (!this.sys || !this.scene.isActive()) return;
    const total = v.seats.length;
    const heroIdx = v.seats.findIndex((s) => s.isHuman);
    const order = (i: number) => (i - heroIdx + total) % total;

    for (const seat of v.seats) {
      const pos = this.seatPosition(order(seat.seat), total);
      this.renderSeat(seat, pos);
      if (seat.isButton) {
        this.dealerBtn.setVisible(true);
        this.tweens.add({
          targets: this.dealerBtn,
          x: pos.x + 40, y: pos.y - 36, duration: 250, ease: 'Quad.out',
        });
      }
    }
    // remove seats no longer present
    for (const [idx, objs] of this.seatObjs) {
      if (!v.seats.some((s) => s.seat === idx)) {
        objs.container.destroy();
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
    const container = this.add.container(pos.x, pos.y);
    const actGlow = this.add.circle(0, 0, 36, 0xe8743b, 0.0);
    const ring = this.add.circle(0, 0, 30, 0x000000, 0).setStrokeStyle(3, BRASS, 0.9);
    const avatar = this.makeAvatar(seat);
    const nameText = this.add.text(0, 34, seat.name, {
      fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#F2E9D8', fontStyle: 'bold',
    }).setOrigin(0.5);
    const stackText = this.add.text(0, 50, '', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#E4C878',
    }).setOrigin(0.5);
    container.add([actGlow, ring, avatar, nameText, stackText]);

    const betText = this.add.text(pos.x, pos.y, '', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#F2E9D8', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(15);

    o = {
      container, cardSprites: [], betText, betChip: null, stackText, nameText, ring, avatar, actGlow,
      bubble: null, lastCardsKey: '', badge: null,
    };
    this.seatObjs.set(seat.seat, o);
    return o;
  }

  private makeAvatar(seat: PokerSeatView): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const hue = [...seat.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
    const col = Phaser.Display.Color.HSVToRGB(hue / 360, 0.5, 0.4) as Phaser.Types.Display.ColorObject;
    const disc = this.add.circle(0, 0, 27, Phaser.Display.Color.GetColor(col.r, col.g, col.b));
    const letter = this.add.text(0, 0, seat.name.slice(0, 1).toUpperCase(), {
      fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#F2E9D8', fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([disc, letter]);
    return c;
  }

  private renderSeat(seat: PokerSeatView, pos: { x: number; y: number }) {
    const o = this.getSeatObjs(seat, pos);
    o.container.setPosition(pos.x, pos.y);
    o.container.setAlpha(seat.folded ? 0.42 : 1);
    o.nameText.setText(seat.name);
    o.stackText.setText(seat.allIn ? 'ALL IN' : seat.stack.toLocaleString());
    o.stackText.setColor(seat.allIn ? '#E8743B' : '#E4C878');

    // acting glow
    o.actGlow.setFillStyle(0xe8743b, seat.isActing ? 0.0 : 0);
    if (seat.isActing) {
      o.ring.setStrokeStyle(3, 0xe8743b, 1);
      this.tweens.add({ targets: o.actGlow, fillAlpha: 0.4, scale: 1.25, yoyo: true, repeat: -1, duration: 600 });
    } else {
      o.ring.setStrokeStyle(3, BRASS, 0.9);
      this.tweens.killTweensOf(o.actGlow);
      o.actGlow.setScale(1).setFillStyle(0xe8743b, 0);
    }

    // cards
    this.renderSeatCards(seat, pos, o);

    // bet chips toward center
    if (seat.bet > 0) {
      const bx = pos.x + (this.centerX - pos.x) * 0.32;
      const by = pos.y + (this.centerY - pos.y) * 0.32;
      if (!o.betChip) {
        o.betChip = this.add.image(pos.x, pos.y, `chip-${chipLabelFor(seat.bet)}`).setScale(0.34).setDepth(14);
      }
      o.betChip.setTexture(`chip-${chipLabelFor(seat.bet)}`).setVisible(true);
      this.tweens.add({ targets: o.betChip, x: bx, y: by - 14, duration: 220, ease: 'Quad.out' });
      o.betText.setText(seat.bet.toLocaleString()).setVisible(true).setPosition(bx, by + 6);
    } else {
      o.betChip?.setVisible(false);
      o.betText.setVisible(false);
    }

    // status badge (SB/BB)
    this.renderBadge(seat, pos, o);

    // bubble — only when the action or chat actually changes, so it doesn't
    // re-pop on every state refresh.
    const actionChanged = seat.lastAction !== o.lastAction;
    o.lastAction = seat.lastAction;
    this.renderBubble(seat, pos, o, actionChanged);
  }

  private renderBadge(seat: PokerSeatView, pos: { x: number; y: number }, o: SeatObjs) {
    if (seat.status) {
      if (!o.badge) {
        const c = this.add.container(pos.x - 34, pos.y - 24).setDepth(16);
        const bg = this.add.circle(0, 0, 11, 0x1a1410).setStrokeStyle(1.5, BRASS);
        const t = this.add.text(0, 0, seat.status, { fontFamily: 'Inter', fontSize: '10px', color: '#E4C878', fontStyle: 'bold' }).setOrigin(0.5);
        c.add([bg, t]);
        o.badge = c;
      } else {
        o.badge.setPosition(pos.x - 34, pos.y - 24).setVisible(true);
        (o.badge.list[1] as Phaser.GameObjects.Text).setText(seat.status);
      }
    } else {
      o.badge?.setVisible(false);
    }
  }

  private renderBubble(seat: PokerSeatView, pos: { x: number; y: number }, o: SeatObjs, actionChanged: boolean) {
    const chat = seat.bubble;
    const actionLabel = actionChanged && seat.lastAction && !seat.folded ? labelAction(seat.lastAction) : '';
    const text = chat || actionLabel;
    if (text) {
      if (o.bubble) o.bubble.destroy();
      const c = this.add.container(pos.x, pos.y - 56).setDepth(18);
      const t = this.add.text(0, 0, text, { fontFamily: 'Inter', fontSize: '11px', color: '#1a1410', fontStyle: 'bold' }).setOrigin(0.5);
      const pad = 8;
      const bg = this.add.rectangle(0, 0, t.width + pad * 2, t.height + pad, 0xf2e9d8, 1).setStrokeStyle(1, BRASS);
      bg.setOrigin(0.5);
      c.add([bg, t]);
      c.setScale(0.6);
      this.tweens.add({ targets: c, scale: 1, duration: 160, ease: 'Back.out' });
      o.bubble = c;
      this.time.delayedCall(1400, () => { if (o.bubble === c) { c.destroy(); o.bubble = null; } });
    }
  }

  private renderSeatCards(seat: PokerSeatView, pos: { x: number; y: number }, o: SeatObjs) {
    const key = seat.cards.join(',') + '|' + (seat.showCards ? 'f' : seat.folded ? 'x' : 'b') + (seat.isHuman ? 'h' : '');
    if (key === o.lastCardsKey) return;
    o.lastCardsKey = key;
    o.cardSprites.forEach((s) => s.destroy());
    o.cardSprites = [];
    if (seat.folded) return;

    const cw = seat.isHuman ? 58 : 34;
    const ch = cw * CARD_RATIO;
    const towardCenter = Math.sign(this.centerY - pos.y) || -1;
    const cy = pos.y - 6 + (seat.isHuman ? 4 : -2) * towardCenter;
    const showFaces = seat.showCards && seat.cards.length > 0;
    const n = 2;
    for (let i = 0; i < n; i++) {
      const card = seat.cards[i];
      const texKey = showFaces && card ? cardTexture(this, card) : cardBackTexture(this);
      const x = pos.x + (i - 0.5) * (cw * 0.62);
      const sprite = this.add.image(this.centerX, this.centerY, texKey)
        .setDisplaySize(cw, ch).setDepth(10).setAngle((i - 0.5) * 8);
      o.cardSprites.push(sprite);
      this.tweens.add({
        targets: sprite, x, y: cy, duration: 320, delay: i * 80, ease: 'Cubic.out',
      });
    }
  }

  private renderBoard(cards: string[], animate: boolean) {
    const cw = Math.min(64, this.tableW * 0.13);
    const ch = cw * CARD_RATIO;
    const gap = cw * 1.12;
    const startX = this.centerX - (gap * (5 - 1)) / 2;
    const y = this.centerY - this.tableH * 0.06;

    // add any new cards
    for (let i = 0; i < cards.length; i++) {
      if (this.boardSprites[i]) continue;
      const tex = cardTexture(this, cards[i]);
      const sprite = this.add.image(animate ? this.centerX : startX + i * gap, y, tex)
        .setDisplaySize(cw, ch).setDepth(8);
      this.boardSprites[i] = sprite;
      if (animate) {
        sprite.setScale(0).setAngle(-20);
        this.tweens.add({
          targets: sprite, x: startX + i * gap, displayWidth: cw, displayHeight: ch,
          scaleX: 1, scaleY: 1, angle: 0, duration: 360, delay: i * 90, ease: 'Back.out',
        });
      } else {
        sprite.setPosition(startX + i * gap, y);
      }
    }
    // clear board on new hand (fewer cards than before)
    if (cards.length < this.boardSprites.length) {
      this.boardSprites.forEach((s) => s?.destroy());
      this.boardSprites = [];
    }
  }

  private celebrate({ seat, amount, big }: { seat: number; amount: number; big: boolean }) {
    // chips fly from pot to the winner, then a particle burst.
    const view = this.currentView;
    if (!view) return;
    const total = view.seats.length;
    const heroIdx = view.seats.findIndex((s) => s.isHuman);
    const order = (i: number) => (i - heroIdx + total) % total;
    const pos = this.seatPosition(order(seat), total);

    const count = big ? 16 : 7;
    for (let i = 0; i < count; i++) {
      const chip = this.add.image(this.centerX, this.centerY + this.tableH * 0.1, 'chip-gold')
        .setScale(0.34).setDepth(30);
      this.tweens.add({
        targets: chip, x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + (Math.random() - 0.5) * 24,
        duration: 420 + Math.random() * 200, delay: i * 28, ease: 'Cubic.out',
        onComplete: () => chip.destroy(),
      });
    }

    const win = this.add.text(pos.x, pos.y - 40, `+${amount.toLocaleString()}`, {
      fontFamily: 'Zilla Slab, serif', fontSize: big ? '30px' : '20px', color: '#FFB37A', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(40).setScale(0.4);
    this.tweens.add({ targets: win, scale: 1, y: pos.y - 64, duration: 500, ease: 'Back.out' });
    this.tweens.add({ targets: win, alpha: 0, delay: 1400, duration: 500, onComplete: () => win.destroy() });

    if (big) this.bigBurst(pos.x, pos.y);
  }

  private bigBurst(x: number, y: number) {
    const colors = [0xc9a24b, 0xe8743b, 0xf2e9d8, 0xe4c878];
    for (let i = 0; i < 40; i++) {
      const p = this.add.rectangle(this.centerX, this.centerY, 6, 10,
        colors[i % colors.length]).setDepth(35);
      const ang = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 160;
      this.tweens.add({
        targets: p,
        x: this.centerX + Math.cos(ang) * dist,
        y: this.centerY + Math.sin(ang) * dist + 60,
        angle: Math.random() * 360, alpha: 0, duration: 900 + Math.random() * 500,
        ease: 'Cubic.out', onComplete: () => p.destroy(),
      });
    }
    void x; void y;
  }
}

function chipLabelFor(value: number): string {
  return chipLabelByStyle(chipStyleFor(value));
}
function chipLabelByStyle(style: ReturnType<typeof chipStyleFor>): string {
  // map back: find label whose style matches body color
  const map: Record<string, string> = {
    '#b5304a': 'red', '#2fa37c': 'green', '#2a211a': 'walnut',
    '#e8743b': 'amber', '#7d4fb0': 'violet', '#c9a24b': 'gold',
  };
  return map[style.body] ?? 'walnut';
}
function chipStyleForLabel(label: string) {
  const bodies: Record<string, any> = {
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

void CREAM;
