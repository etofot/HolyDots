/**
 * Distinct cube silhouettes per color — readable at 45px, not flat placeholders.
 * Shape + hue + glyph so colorblind-adjacent play stays legible.
 */

import Phaser from 'phaser';
import type { CubeColor } from './constants';
import { CELL_SIZE, COLOR_HEX } from './constants';

const HALF = CELL_SIZE / 2 - 2;

function poly(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[], fill: number, alpha = 1) {
  g.fillStyle(fill, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.fillPath();
}

function strokePoly(
  g: Phaser.GameObjects.Graphics,
  pts: { x: number; y: number }[],
  color: number,
  alpha: number,
  width = 2
) {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.strokePath();
}

function regularPoly(cx: number, cy: number, r: number, n: number, rot = 0) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export interface PaintOpts {
  selected?: boolean;
  rising?: boolean;
  stuck?: boolean;
  /** Predicted to detonate on next lock — gold arming glow */
  armed?: boolean;
  /** One recolor from armed — amber "HOT" telegraph */
  hot?: boolean;
  /** Soft ghost dim for stack residue */
  dim?: boolean;
}

/** Body shape path by color — unique silhouette family per hue. */
export function paintCubeBody(
  g: Phaser.GameObjects.Graphics,
  color: CubeColor,
  opts?: PaintOpts
): void {
  g.clear();
  const { top, bot } = COLOR_HEX[color];
  const selected = opts?.selected ?? false;
  const rising = opts?.rising ?? false;
  const stuck = opts?.stuck ?? false;
  const armed = opts?.armed ?? false;
  const hot = opts?.hot ?? false;
  const dim = opts?.dim ?? false;

  // Drop shadow
  g.fillStyle(0x000000, 0.32);
  g.fillEllipse(2, HALF - 3, HALF * 1.65, HALF * 0.5);

  // Dark chassis plate (silhouette punch against dark board)
  g.fillStyle(0x08080f, 0.98);
  g.fillRoundedRect(-HALF - 2, -HALF - 2, HALF * 2 + 4, HALF * 2 + 4, 10);

  // Inner bevel ring
  g.lineStyle(1, 0xffffff, 0.12);
  g.strokeRoundedRect(-HALF - 0.5, -HALF - 0.5, HALF * 2 + 1, HALF * 2 + 1, 9);

  // Color body by silhouette family
  switch (color) {
    case 'yellow': {
      // Sun diamond — angular energy
      const diamond = regularPoly(0, 0, HALF - 1, 4, Math.PI / 4);
      poly(g, diamond, bot);
      poly(g, regularPoly(0, -1, HALF - 4, 4, Math.PI / 4), top);
      g.fillStyle(0xffffff, 0.45);
      poly(g, regularPoly(0, -3, HALF * 0.38, 4, Math.PI / 4), 0xfff6a0, 0.6);
      // Rays from core
      g.lineStyle(2.5, 0xfff0a0, 0.55);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        g.lineBetween(
          Math.cos(a) * 6,
          Math.sin(a) * 6,
          Math.cos(a) * (HALF - 5),
          Math.sin(a) * (HALF - 5)
        );
      }
      // Glyph: diamond chip
      g.fillStyle(0x8a6000, 0.55);
      poly(g, regularPoly(0, 2, 4, 4, Math.PI / 4), 0x8a6000, 0.5);
      break;
    }
    case 'blue': {
      // Hex crystal
      const hex = regularPoly(0, 0, HALF - 2, 6, Math.PI / 6);
      poly(g, hex, bot);
      poly(g, regularPoly(0, -1, HALF - 5, 6, Math.PI / 6), top);
      g.fillStyle(0xffffff, 0.5);
      poly(g, regularPoly(-4, -5, HALF * 0.26, 6, Math.PI / 6), 0xa0f0ff, 0.55);
      strokePoly(g, hex, 0x003355, 0.45, 2);
      // Facet lines
      g.lineStyle(1, 0xffffff, 0.2);
      g.lineBetween(0, -HALF + 6, 0, HALF - 6);
      g.lineBetween(-HALF + 8, 0, HALF - 8, 0);
      break;
    }
    case 'green': {
      // Emerald disc + leaf notch
      g.fillStyle(bot, 1);
      g.fillCircle(0, 0, HALF - 1);
      g.fillStyle(top, 1);
      g.fillCircle(0, 0, HALF - 5);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(-5, -6, 5.5);
      g.lineStyle(2.5, 0x0a3a1a, 0.5);
      g.strokeCircle(0, 0, HALF - 2);
      // Leaf bar glyph
      g.fillStyle(0x0a3a1a, 0.55);
      g.fillRoundedRect(-7, -2, 14, 5, 2);
      g.fillStyle(0xa0ffb0, 0.7);
      g.fillRoundedRect(-5, -1, 10, 3, 1.5);
      break;
    }
    case 'white': {
      // Pearl octagon
      const oct = regularPoly(0, 0, HALF - 2, 8, Math.PI / 8);
      poly(g, oct, bot);
      poly(g, regularPoly(0, -1, HALF - 5, 8, Math.PI / 8), top);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(-4, -5, 6);
      g.fillStyle(0xd0d0e8, 0.5);
      g.fillCircle(4, 5, 3);
      strokePoly(g, oct, 0x666688, 0.45, 2);
      // Cross glyph for neutral
      g.lineStyle(2, 0x8888aa, 0.45);
      g.lineBetween(-5, 0, 5, 0);
      g.lineBetween(0, -5, 0, 5);
      break;
    }
    case 'red': {
      // Wild heat — flame star + white core
      const star = regularPoly(0, 0, HALF - 1, 5, -Math.PI / 2);
      poly(g, star, bot);
      poly(g, regularPoly(0, 1, HALF * 0.62, 5, -Math.PI / 2), top);
      g.fillStyle(0xffaa00, 0.95);
      poly(g, regularPoly(0, 1, HALF * 0.42, 5, -Math.PI / 2), 0xffaa00);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 0, 5);
      g.lineStyle(2.5, 0xffffff, 0.9);
      g.strokeCircle(0, 0, HALF - 4);
      // Ember tips
      g.fillStyle(0xffee88, 0.85);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        g.fillCircle(Math.cos(a) * (HALF - 3), Math.sin(a) * (HALF - 3), 2.2);
      }
      break;
    }
    default:
      g.fillStyle(top, 1);
      g.fillRoundedRect(-HALF, -HALF, HALF * 2, HALF * 2, 8);
  }

  // Specular rim
  g.lineStyle(1.5, 0xffffff, color === 'red' ? 0.75 : 0.28);
  g.strokeRoundedRect(-HALF + 1, -HALF + 1, HALF * 2 - 2, HALF * 2 - 2, 8);

  if (dim) {
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(-HALF - 2, -HALF - 2, HALF * 2 + 4, HALF * 2 + 4, 10);
  }

  // State overlays
  if (stuck) {
    g.fillStyle(0x000000, 0.1);
    g.fillRoundedRect(-HALF, -HALF, HALF * 2, HALF * 2, 8);
    // Ceiling grip marks
    g.lineStyle(1, 0xffffff, 0.12);
    g.lineBetween(-HALF + 4, -HALF + 4, HALF - 4, -HALF + 4);
  }
  if (rising) {
    g.lineStyle(2.5, 0xffd700, 0.55);
    g.strokeRoundedRect(-HALF + 1, -HALF + 1, HALF * 2 - 2, HALF * 2 - 2, 7);
    // Up-chevron
    g.lineStyle(2, 0xffffff, 0.5);
    g.lineBetween(-6, 4, 0, -4);
    g.lineBetween(0, -4, 6, 4);
  }
  if (armed) {
    g.lineStyle(3, 0xffd700, 0.95);
    g.strokeRoundedRect(-HALF - 3, -HALF - 3, HALF * 2 + 6, HALF * 2 + 6, 11);
    g.fillStyle(0xffd700, 0.14);
    g.fillRoundedRect(-HALF - 3, -HALF - 3, HALF * 2 + 6, HALF * 2 + 6, 11);
    // Outer spark ring
    g.lineStyle(1.5, 0xffffff, 0.55);
    g.strokeRoundedRect(-HALF - 5, -HALF - 5, HALF * 2 + 10, HALF * 2 + 10, 12);
  } else if (hot) {
    // Almost-armed: amber dashed feel via double stroke
    g.lineStyle(2.5, 0xff8800, 0.85);
    g.strokeRoundedRect(-HALF - 2, -HALF - 2, HALF * 2 + 4, HALF * 2 + 4, 10);
    g.fillStyle(0xff8800, 0.08);
    g.fillRoundedRect(-HALF - 2, -HALF - 2, HALF * 2 + 4, HALF * 2 + 4, 10);
  }
  if (selected) {
    g.lineStyle(3, 0xffffff, 1);
    g.strokeRoundedRect(-HALF - 3, -HALF - 3, HALF * 2 + 6, HALF * 2 + 6, 11);
  }
}

export function colorGlyph(color: CubeColor): string {
  switch (color) {
    case 'yellow':
      return '◆';
    case 'blue':
      return '⬡';
    case 'green':
      return '●';
    case 'white':
      return '◈';
    case 'red':
      return '★';
    default:
      return '';
  }
}
