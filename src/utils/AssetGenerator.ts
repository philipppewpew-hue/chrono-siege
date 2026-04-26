import * as Phaser from 'phaser';
import { TILE_SIZE, TOWERS, TOWER_ORDER, ENEMIES, COLORS } from '../config';

export function generateAssets(scene: Phaser.Scene): void {
  generateTileTextures(scene);
  generateTowerTextures(scene);
  generateEnemyTextures(scene);
  generateProjectileTextures(scene);
  generateMiscTextures(scene);
  generateUITextures(scene);
  generateParticleTextures(scene);
}

function generateTileTextures(scene: Phaser.Scene): void {
  const s = TILE_SIZE;

  // Grass tile
  const grass = scene.make.graphics({ x: 0, y: 0 });
  grass.fillStyle(0x1a2e1a);
  grass.fillRect(0, 0, s, s);
  // Subtle texture dots
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    grass.fillStyle(0x223822, 0.5);
    grass.fillRect(x, y, 2, 2);
  }
  grass.lineStyle(1, 0x2a3a2a, 0.3);
  grass.strokeRect(0, 0, s, s);
  grass.generateTexture('tile_grass', s, s);
  grass.destroy();

  // Path tile
  const path = scene.make.graphics({ x: 0, y: 0 });
  path.fillStyle(0x2a1e12);
  path.fillRect(0, 0, s, s);
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    path.fillStyle(0x3a2a1a, 0.4);
    path.fillRect(x, y, 3, 2);
  }
  path.generateTexture('tile_path', s, s);
  path.destroy();

  // Spawn tile
  const spawn = scene.make.graphics({ x: 0, y: 0 });
  spawn.fillStyle(0x3a1515);
  spawn.fillRect(0, 0, s, s);
  spawn.lineStyle(2, 0xff4444, 0.5);
  spawn.strokeRect(2, 2, s - 4, s - 4);
  spawn.fillStyle(0xff4444, 0.2);
  spawn.fillTriangle(s / 2, 8, s - 8, s / 2, s / 2, s - 8);
  spawn.generateTexture('tile_spawn', s, s);
  spawn.destroy();

  // Base tile
  const base = scene.make.graphics({ x: 0, y: 0 });
  base.fillStyle(0x151535);
  base.fillRect(0, 0, s, s);
  base.lineStyle(2, 0x4488ff, 0.6);
  base.strokeRect(2, 2, s - 4, s - 4);
  base.fillStyle(0x4488ff, 0.25);
  base.fillCircle(s / 2, s / 2, s * 0.3);
  base.generateTexture('tile_base', s, s);
  base.destroy();

  // Blocked tile (water/rock)
  const blocked = scene.make.graphics({ x: 0, y: 0 });
  blocked.fillStyle(0x0a1525);
  blocked.fillRect(0, 0, s, s);
  for (let i = 0; i < 5; i++) {
    blocked.fillStyle(0x0f1a30, 0.6);
    const x = Math.random() * (s - 10) + 5;
    const y = Math.random() * (s - 10) + 5;
    blocked.fillCircle(x, y, 4 + Math.random() * 4);
  }
  blocked.generateTexture('tile_blocked', s, s);
  blocked.destroy();
}

function generateTowerTextures(scene: Phaser.Scene): void {
  const s = TILE_SIZE;

  for (const id of TOWER_ORDER) {
    const def = TOWERS[id];

    for (let level = 0; level < 3; level++) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      const suffix = level > 0 ? `_${level + 1}` : '';

      // Base platform
      const baseColor = Phaser.Display.Color.IntegerToColor(def.color);
      const darkerBase = baseColor.clone().darken(40);
      g.fillStyle(darkerBase.color, 0.9);
      g.fillRoundedRect(4, 4, s - 8, s - 8, 4);

      // Level indicators (small dots)
      for (let i = 0; i <= level; i++) {
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(s / 2 - (level * 4) + i * 8, s - 8, 2);
      }

      // Tower body based on type
      g.fillStyle(def.color);

      switch (id) {
        case 'arrow':
          // Slim tower with pointed top
          g.fillRect(s / 2 - 5, 12, 10, s - 26);
          g.fillTriangle(s / 2, 6, s / 2 - 8, 18, s / 2 + 8, 18);
          break;
        case 'cannon':
          // Wide, squat tower with barrel
          g.fillRect(s / 2 - 10, 16, 20, s - 30);
          g.fillStyle(Phaser.Display.Color.IntegerToColor(def.color).darken(20).color);
          g.fillRect(s / 2 - 4, 8, 8, 16);
          g.fillCircle(s / 2, 8, 5);
          break;
        case 'frost':
          // Crystal shape
          g.fillStyle(def.color, 0.8);
          g.fillTriangle(s / 2, 6, s / 2 - 12, s / 2 + 4, s / 2 + 12, s / 2 + 4);
          g.fillTriangle(s / 2, s - 10, s / 2 - 10, s / 2, s / 2 + 10, s / 2);
          g.fillStyle(0xffffff, 0.3);
          g.fillCircle(s / 2, s / 2, 4);
          break;
        case 'lightning':
          // Lightning rod shape
          g.fillRect(s / 2 - 3, 10, 6, s - 24);
          g.fillStyle(def.glowColor);
          g.fillCircle(s / 2, 10, 6);
          // Lightning bolt accent
          g.lineStyle(2, 0xffff00, 0.8);
          g.lineBetween(s / 2 - 4, 18, s / 2 + 3, 24);
          g.lineBetween(s / 2 + 3, 24, s / 2 - 3, 30);
          break;
        case 'poison':
          // Bubbling cauldron
          g.fillStyle(def.color, 0.7);
          g.fillCircle(s / 2, s / 2 + 2, 12);
          g.fillStyle(def.glowColor, 0.5);
          g.fillCircle(s / 2 - 4, s / 2 - 4, 4);
          g.fillCircle(s / 2 + 5, s / 2 - 2, 3);
          g.fillCircle(s / 2, s / 2 - 8, 2);
          break;
        case 'chrono':
          // Hourglass / clock shape
          g.fillStyle(def.color, 0.8);
          g.fillTriangle(s / 2, s / 2, s / 2 - 10, 8, s / 2 + 10, 8);
          g.fillTriangle(s / 2, s / 2, s / 2 - 10, s - 10, s / 2 + 10, s - 10);
          g.fillStyle(def.glowColor, 0.4);
          g.fillCircle(s / 2, s / 2, 5);
          // Clock hands
          g.lineStyle(1.5, 0xffffff, 0.6);
          g.lineBetween(s / 2, s / 2, s / 2 + 4, s / 2 - 4);
          g.lineBetween(s / 2, s / 2, s / 2 - 2, s / 2 + 3);
          break;
      }

      // Glow effect for higher levels
      if (level > 0) {
        g.fillStyle(def.glowColor, 0.1 + level * 0.05);
        g.fillCircle(s / 2, s / 2, s * 0.4);
      }

      g.generateTexture(`tower_${id}${suffix}`, s, s);
      g.destroy();
    }
  }

  // Tower placement ghost
  const ghost = scene.make.graphics({ x: 0, y: 0 });
  ghost.fillStyle(0xffffff, 0.3);
  ghost.fillRoundedRect(2, 2, s - 4, s - 4, 4);
  ghost.lineStyle(1, 0xffffff, 0.5);
  ghost.strokeRoundedRect(2, 2, s - 4, s - 4, 4);
  ghost.generateTexture('tower_ghost', s, s);
  ghost.destroy();

  // Sell icon
  const sell = scene.make.graphics({ x: 0, y: 0 });
  sell.fillStyle(0x882222);
  sell.fillRoundedRect(0, 0, 32, 32, 4);
  sell.lineStyle(2, 0xff4444);
  sell.lineBetween(8, 8, 24, 24);
  sell.lineBetween(24, 8, 8, 24);
  sell.generateTexture('icon_sell', 32, 32);
  sell.destroy();
}

function generateEnemyTextures(scene: Phaser.Scene): void {
  const s = TILE_SIZE;

  for (const [id, def] of Object.entries(ENEMIES)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const cx = s / 2;
    const cy = s / 2;
    const r = (s / 2 - 6) * def.size;

    switch (id) {
      case 'scout':
        // Small triangle (fast)
        g.fillStyle(def.color);
        g.fillTriangle(cx, cy - r, cx - r * 0.8, cy + r * 0.6, cx + r * 0.8, cy + r * 0.6);
        g.fillStyle(0xffffff, 0.3);
        g.fillTriangle(cx, cy - r * 0.5, cx - r * 0.3, cy + r * 0.2, cx + r * 0.3, cy + r * 0.2);
        break;
      case 'soldier':
        // Pentagon
        g.fillStyle(def.color);
        drawRegularPolygon(g, cx, cy, r, 5);
        g.fillStyle(0xffffff, 0.2);
        g.fillCircle(cx, cy, r * 0.3);
        break;
      case 'knight':
        // Square with shield look
        g.fillStyle(def.color);
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
        g.lineStyle(2, 0xaaaacc, 0.8);
        g.strokeRect(cx - r + 2, cy - r + 2, r * 2 - 4, r * 2 - 4);
        g.fillStyle(0xffffff, 0.15);
        g.fillRect(cx - r * 0.3, cy - r, r * 0.6, r * 2);
        g.fillRect(cx - r, cy - r * 0.3, r * 2, r * 0.6);
        break;
      case 'assassin':
        // Diamond (agile)
        g.fillStyle(def.color);
        g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
        g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);
        g.fillStyle(0xffffff, 0.3);
        g.fillCircle(cx, cy, r * 0.2);
        break;
      case 'healer':
        // Circle with cross
        g.fillStyle(def.color, 0.8);
        g.fillCircle(cx, cy, r);
        g.fillStyle(0xffffff, 0.5);
        g.fillRect(cx - r * 0.15, cy - r * 0.6, r * 0.3, r * 1.2);
        g.fillRect(cx - r * 0.6, cy - r * 0.15, r * 1.2, r * 0.3);
        break;
      case 'splitter':
        // Two overlapping circles
        g.fillStyle(def.color, 0.7);
        g.fillCircle(cx - r * 0.3, cy, r * 0.7);
        g.fillCircle(cx + r * 0.3, cy, r * 0.7);
        g.fillStyle(0xffffff, 0.2);
        g.fillCircle(cx, cy, r * 0.25);
        break;
      case 'phantom':
        // Ghost shape
        g.fillStyle(def.color, 0.6);
        g.fillCircle(cx, cy - r * 0.2, r * 0.8);
        g.fillRect(cx - r * 0.8, cy - r * 0.2, r * 1.6, r * 0.8);
        // Wavy bottom
        for (let i = 0; i < 4; i++) {
          const bx = cx - r * 0.7 + i * r * 0.47;
          g.fillCircle(bx, cy + r * 0.6, r * 0.25);
        }
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(cx - r * 0.25, cy - r * 0.3, r * 0.15);
        g.fillCircle(cx + r * 0.25, cy - r * 0.3, r * 0.15);
        break;
      case 'titan':
        // Large hexagon with menacing look
        g.fillStyle(def.color);
        drawRegularPolygon(g, cx, cy, r, 6);
        g.lineStyle(2, 0xff6644, 0.8);
        drawRegularPolygonStroke(g, cx, cy, r, 6);
        g.fillStyle(0xff0000, 0.4);
        g.fillCircle(cx - r * 0.25, cy - r * 0.15, r * 0.2);
        g.fillCircle(cx + r * 0.25, cy - r * 0.15, r * 0.2);
        g.lineStyle(2, 0xffaa00, 0.6);
        g.lineBetween(cx - r * 0.3, cy + r * 0.3, cx + r * 0.3, cy + r * 0.3);
        break;
    }

    g.generateTexture(`enemy_${id}`, s, s);
    g.destroy();

    // Mini version for split enemies
    if (id === 'splitter') {
      const gm = scene.make.graphics({ x: 0, y: 0 });
      const mr = r * 0.5;
      gm.fillStyle(def.color, 0.8);
      gm.fillCircle(cx, cy, mr);
      gm.fillStyle(0xffffff, 0.2);
      gm.fillCircle(cx, cy, mr * 0.3);
      gm.generateTexture('enemy_splitter_mini', s, s);
      gm.destroy();
    }
  }
}

function generateProjectileTextures(scene: Phaser.Scene): void {
  const projTypes: Array<{ id: string; color: number; size: number; type: string }> = [
    { id: 'arrow', color: 0x88cc44, size: 8, type: 'arrow' },
    { id: 'cannon', color: 0xcc6622, size: 10, type: 'ball' },
    { id: 'frost', color: 0x44aaee, size: 8, type: 'crystal' },
    { id: 'lightning', color: 0xdddd44, size: 6, type: 'bolt' },
    { id: 'poison', color: 0x66cc66, size: 8, type: 'blob' },
    { id: 'chrono', color: 0xaa44dd, size: 10, type: 'orb' },
  ];

  for (const p of projTypes) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const cx = 16, cy = 16;

    switch (p.type) {
      case 'arrow':
        g.fillStyle(p.color);
        g.fillTriangle(cx, cy - p.size / 2, cx - p.size / 2, cy + p.size / 2, cx + p.size / 2, cy + p.size / 2);
        break;
      case 'ball':
        g.fillStyle(p.color);
        g.fillCircle(cx, cy, p.size / 2);
        g.fillStyle(0xffffff, 0.3);
        g.fillCircle(cx - 1, cy - 1, p.size / 4);
        break;
      case 'crystal':
        g.fillStyle(p.color, 0.8);
        g.fillTriangle(cx, cy - p.size / 2, cx - p.size / 3, cy, cx + p.size / 3, cy);
        g.fillTriangle(cx, cy + p.size / 2, cx - p.size / 3, cy, cx + p.size / 3, cy);
        break;
      case 'bolt':
        g.fillStyle(p.color);
        g.fillCircle(cx, cy, p.size / 2);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(cx, cy, p.size / 4);
        break;
      case 'blob':
        g.fillStyle(p.color, 0.7);
        g.fillCircle(cx, cy, p.size / 2);
        g.fillCircle(cx + 2, cy - 2, p.size / 3);
        break;
      case 'orb':
        g.fillStyle(p.color, 0.5);
        g.fillCircle(cx, cy, p.size / 2 + 2);
        g.fillStyle(p.color, 0.8);
        g.fillCircle(cx, cy, p.size / 3);
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(cx - 1, cy - 1, p.size / 5);
        break;
    }

    g.generateTexture(`proj_${p.id}`, 32, 32);
    g.destroy();
  }
}

function generateUITextures(scene: Phaser.Scene): void {
  // Button
  const btn = scene.make.graphics({ x: 0, y: 0 });
  btn.fillStyle(0x223344);
  btn.fillRoundedRect(0, 0, 200, 50, 8);
  btn.lineStyle(2, 0x4488aa);
  btn.strokeRoundedRect(0, 0, 200, 50, 8);
  btn.generateTexture('btn_normal', 200, 50);
  btn.destroy();

  const btnHover = scene.make.graphics({ x: 0, y: 0 });
  btnHover.fillStyle(0x334455);
  btnHover.fillRoundedRect(0, 0, 200, 50, 8);
  btnHover.lineStyle(2, 0x66aacc);
  btnHover.strokeRoundedRect(0, 0, 200, 50, 8);
  btnHover.generateTexture('btn_hover', 200, 50);
  btnHover.destroy();

  // Tower panel button
  for (const id of TOWER_ORDER) {
    const def = TOWERS[id];
    const tw = 54, th = 54;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x1a1a2e);
    g.fillRoundedRect(0, 0, tw, th, 4);
    g.lineStyle(1.5, def.color, 0.6);
    g.strokeRoundedRect(0, 0, tw, th, 4);
    g.generateTexture(`tower_btn_${id}`, tw, th);
    g.destroy();

    // Selected version
    const gs = scene.make.graphics({ x: 0, y: 0 });
    gs.fillStyle(0x2a2a4e);
    gs.fillRoundedRect(0, 0, tw, th, 4);
    gs.lineStyle(2, def.color, 1.0);
    gs.strokeRoundedRect(0, 0, tw, th, 4);
    gs.fillStyle(def.color, 0.15);
    gs.fillRoundedRect(2, 2, tw - 4, th - 4, 3);
    gs.generateTexture(`tower_btn_${id}_sel`, tw, th);
    gs.destroy();
  }

  // Speed button
  for (const speed of [1, 2, 3]) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(speed === 1 ? 0x223344 : 0x334455);
    g.fillRoundedRect(0, 0, 40, 30, 4);
    g.lineStyle(1, 0x4488aa);
    g.strokeRoundedRect(0, 0, 40, 30, 4);
    g.generateTexture(`btn_speed_${speed}`, 40, 30);
    g.destroy();
  }
}

function generateParticleTextures(scene: Phaser.Scene): void {
  // Soft circle particle (multi-layer gradient for smooth falloff)
  const particle = scene.make.graphics({ x: 0, y: 0 });
  for (let i = 8; i > 0; i--) {
    const a = (i / 8) * 0.8;
    particle.fillStyle(0xffffff, a);
    particle.fillCircle(16, 16, i * 2);
  }
  particle.generateTexture('particle', 32, 32);
  particle.destroy();

  // Large soft glow (smooth gradient)
  const glow = scene.make.graphics({ x: 0, y: 0 });
  for (let i = 16; i > 0; i--) {
    const a = (i / 16) * 0.5;
    glow.fillStyle(0xffffff, a);
    glow.fillCircle(32, 32, i * 2);
  }
  glow.generateTexture('glow', 64, 64);
  glow.destroy();

  // Square debris particle
  const sq = scene.make.graphics({ x: 0, y: 0 });
  sq.fillStyle(0xffffff, 0.9);
  sq.fillRect(1, 1, 6, 6);
  sq.fillStyle(0xffffff, 0.4);
  sq.fillRect(0, 0, 8, 8);
  sq.generateTexture('particle_square', 8, 8);
  sq.destroy();

  // Ring (expanding ring for splash effects)
  const ring = scene.make.graphics({ x: 0, y: 0 });
  ring.lineStyle(2, 0xffffff, 0.8);
  ring.strokeCircle(16, 16, 14);
  ring.lineStyle(1, 0xffffff, 0.3);
  ring.strokeCircle(16, 16, 12);
  ring.generateTexture('particle_ring', 32, 32);
  ring.destroy();

  // Smoke puff (soft, large, low alpha)
  const smoke = scene.make.graphics({ x: 0, y: 0 });
  for (let i = 12; i > 0; i--) {
    smoke.fillStyle(0xcccccc, (i / 12) * 0.25);
    smoke.fillCircle(24, 24, i * 2);
  }
  smoke.generateTexture('particle_smoke', 48, 48);
  smoke.destroy();

  // Spark (small bright streak)
  const spark = scene.make.graphics({ x: 0, y: 0 });
  spark.fillStyle(0xffffff, 1.0);
  spark.fillRect(6, 2, 4, 12);
  spark.fillStyle(0xffffff, 0.5);
  spark.fillRect(5, 0, 6, 16);
  spark.generateTexture('particle_spark', 16, 16);
  spark.destroy();

  // Star (4-pointed)
  const star = scene.make.graphics({ x: 0, y: 0 });
  star.fillStyle(0xffffff, 0.9);
  star.fillTriangle(8, 0, 6, 8, 10, 8);
  star.fillTriangle(8, 16, 6, 8, 10, 8);
  star.fillTriangle(0, 8, 8, 6, 8, 10);
  star.fillTriangle(16, 8, 8, 6, 8, 10);
  star.fillStyle(0xffffff, 0.6);
  star.fillCircle(8, 8, 3);
  star.generateTexture('particle_star', 16, 16);
  star.destroy();

  // Flare (bright center with rays)
  const flare = scene.make.graphics({ x: 0, y: 0 });
  for (let i = 16; i > 0; i--) {
    flare.fillStyle(0xffffff, (i / 16) * 0.7);
    flare.fillCircle(16, 16, i);
  }
  flare.fillStyle(0xffffff, 1.0);
  flare.fillCircle(16, 16, 3);
  flare.generateTexture('particle_flare', 32, 32);
  flare.destroy();

  // Magic swirl (small diamond)
  const magic = scene.make.graphics({ x: 0, y: 0 });
  magic.fillStyle(0xffffff, 0.8);
  magic.fillTriangle(8, 0, 0, 8, 8, 16);
  magic.fillTriangle(8, 0, 16, 8, 8, 16);
  magic.fillStyle(0xffffff, 0.4);
  magic.fillCircle(8, 8, 4);
  magic.generateTexture('particle_magic', 16, 16);
  magic.destroy();

  // Bubble (hollow circle)
  const bubble = scene.make.graphics({ x: 0, y: 0 });
  bubble.lineStyle(1.5, 0xffffff, 0.7);
  bubble.strokeCircle(6, 6, 5);
  bubble.fillStyle(0xffffff, 0.15);
  bubble.fillCircle(6, 6, 5);
  bubble.fillStyle(0xffffff, 0.5);
  bubble.fillCircle(4, 4, 1.5);
  bubble.generateTexture('particle_bubble', 12, 12);
  bubble.destroy();

  // Soul orb (enhanced)
  const soul = scene.make.graphics({ x: 0, y: 0 });
  for (let i = 10; i > 0; i--) {
    soul.fillStyle(0xaaddff, (i / 10) * 0.4);
    soul.fillCircle(12, 12, i * 1.2);
  }
  soul.fillStyle(0xffffff, 0.8);
  soul.fillCircle(12, 12, 3);
  soul.generateTexture('soul_orb', 24, 24);
  soul.destroy();
}

function generateMiscTextures(scene: Phaser.Scene): void {
  // Frog easter egg
  const s = TILE_SIZE;
  const frog = scene.make.graphics({ x: 0, y: 0 });
  // Body
  frog.fillStyle(0x33aa33);
  frog.fillEllipse(s / 2, s / 2 + 4, 22, 18);
  // Head
  frog.fillStyle(0x44bb44);
  frog.fillEllipse(s / 2, s / 2 - 6, 18, 14);
  // Eyes
  frog.fillStyle(0xffffff);
  frog.fillCircle(s / 2 - 6, s / 2 - 10, 5);
  frog.fillCircle(s / 2 + 6, s / 2 - 10, 5);
  frog.fillStyle(0x111111);
  frog.fillCircle(s / 2 - 5, s / 2 - 10, 2.5);
  frog.fillCircle(s / 2 + 7, s / 2 - 10, 2.5);
  // Mouth
  frog.lineStyle(1.5, 0x228822, 0.8);
  frog.lineBetween(s / 2 - 5, s / 2 - 2, s / 2 + 5, s / 2 - 2);
  // Legs
  frog.fillStyle(0x33aa33);
  frog.fillEllipse(s / 2 - 10, s / 2 + 10, 8, 5);
  frog.fillEllipse(s / 2 + 10, s / 2 + 10, 8, 5);
  frog.generateTexture('frog', s, s);
  frog.destroy();
}

function drawRegularPolygon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, sides: number): void {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    points.push(new Phaser.Math.Vector2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
  }
  g.fillPoints(points, true);
}

function drawRegularPolygonStroke(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, sides: number): void {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    points.push(new Phaser.Math.Vector2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
  }
  g.strokePoints(points, true);
}
