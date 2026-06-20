import Phaser from 'phaser';
import { renderCardFace, renderCardBack } from '../assets/cardArt';
import type { Card } from '../engine-poker/cards';

const CARD_W = 200;
const CARD_H = 280;

/** Lazily register a card-face texture from our custom canvas renderer. */
export function cardTexture(scene: Phaser.Scene, card: Card): string {
  const key = `card-${card}`;
  if (!scene.textures.exists(key)) {
    const canvas = renderCardFace(card, CARD_W, CARD_H);
    scene.textures.addCanvas(key, canvas);
  }
  return key;
}

export function cardBackTexture(scene: Phaser.Scene): string {
  const key = 'card-back';
  if (!scene.textures.exists(key)) {
    const canvas = renderCardBack(CARD_W, CARD_H);
    scene.textures.addCanvas(key, canvas);
  }
  return key;
}

export const CARD_RATIO = CARD_H / CARD_W;
