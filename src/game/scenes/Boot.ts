import { Scene } from 'phaser';

export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.on('loaderror', (file: { key: string }) => {
      const g = this.add.graphics();
      g.fillGradientStyle(0x1a1020, 0x0a0a1a, 0x2a1010, 0x0a0a1a);
      const w = this.game.config.width as number;
      const h = this.game.config.height as number;
      g.fillRect(0, 0, w, h);
      g.generateTexture(file.key, w, h);
      g.destroy();
    });
  }

  create() {
    const w = this.game.config.width as number;
    const h = this.game.config.height as number;

    // Layered heat-chamber background (readable depth, not flat void)
    const bg = this.add.graphics();
    bg.fillStyle(0x080810, 1);
    bg.fillRect(0, 0, w, h);
    // Ceiling cold plate (stack end)
    bg.fillGradientStyle(0x14142e, 0x14142e, 0x0a0a16, 0x0a0a16, 1, 1, 1, 1);
    bg.fillRect(0, 0, w, h * 0.38);
    // Mid chamber
    bg.fillStyle(0x0c0c18, 0.55);
    bg.fillRect(0, h * 0.3, w, h * 0.3);
    // Floor heat well (fuse end)
    bg.fillGradientStyle(0x1c0a0a, 0x1c0a0a, 0x4a1808, 0x4a1808, 0.95, 0.95, 1, 1);
    bg.fillRect(0, h * 0.52, w, h * 0.48);
    // Heat bloom
    bg.fillStyle(0xff4400, 0.06);
    bg.fillEllipse(w / 2, h * 0.92, w * 0.9, h * 0.28);
    bg.fillStyle(0xffd700, 0.03);
    bg.fillEllipse(w / 2, h * 0.88, w * 0.5, h * 0.12);
    // Soft vignette
    bg.fillStyle(0x000000, 0.4);
    bg.fillRect(0, 0, 20, h);
    bg.fillRect(w - 20, 0, 20, h);
    bg.fillStyle(0x000000, 0.2);
    bg.fillRect(0, 0, w, 24);
    // Ember dust
    for (let i = 0; i < 55; i++) {
      const x = Math.random() * w;
      const y = h * 0.45 + Math.random() * h * 0.55;
      bg.fillStyle(0xff8800, 0.04 + Math.random() * 0.1);
      bg.fillCircle(x, y, 1 + Math.random() * 2.5);
    }
    // Ceiling frost dust
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h * 0.25;
      bg.fillStyle(0x88aaff, 0.04 + Math.random() * 0.06);
      bg.fillCircle(x, y, 1 + Math.random() * 1.5);
    }
    bg.generateTexture('bg', w, h);
    bg.destroy();

    this.scene.start('MainGame');
  }
}
