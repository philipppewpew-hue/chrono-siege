import * as Phaser from 'phaser';
import { generateAssets } from '../utils/AssetGenerator';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Loading text
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'Loading pixel art...', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ccddff',
    }).setOrigin(0.5);

    const progressBg = this.add.graphics();
    progressBg.fillStyle(0x222244);
    progressBg.fillRect(GAME_WIDTH / 2 - 200, GAME_HEIGHT / 2 + 10, 400, 20);
    const progressBar = this.add.graphics();

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x44aaff);
      progressBar.fillRect(GAME_WIDTH / 2 - 198, GAME_HEIGHT / 2 + 12, 396 * value, 16);
    });

    // === TILES (Tiny Town pixel art, CC0 by Kenney) ===
    this.load.image('px_grass', 'assets/tiles/grass.png');
    this.load.image('px_grass2', 'assets/tiles/grass2.png');
    this.load.image('px_path', 'assets/tiles/path.png');
    this.load.image('px_tree', 'assets/tiles/tree.png');
    this.load.image('px_rock', 'assets/tiles/rock.png');
    this.load.image('px_water', 'assets/tiles/water.png');
    this.load.image('px_mushroom', 'assets/tiles/mushroom.png');
    this.load.image('px_chest', 'assets/tiles/chest.png');

    // === ENEMIES (Tiny Dungeon pixel art, CC0 by Kenney) ===
    this.load.image('px_enemy_scout', 'assets/enemies/scout.png');
    this.load.image('px_enemy_soldier', 'assets/enemies/soldier.png');
    this.load.image('px_enemy_knight', 'assets/enemies/knight.png');
    this.load.image('px_enemy_assassin', 'assets/enemies/assassin.png');
    this.load.image('px_enemy_healer', 'assets/enemies/healer.png');
    this.load.image('px_enemy_splitter', 'assets/enemies/splitter.png');
    this.load.image('px_enemy_splitter_mini', 'assets/enemies/splitter_mini.png');
    this.load.image('px_enemy_phantom', 'assets/enemies/phantom.png');
    this.load.image('px_enemy_titan', 'assets/enemies/titan.png');
    this.load.image('px_frog', 'assets/enemies/frog.png');

    // === PARTICLES (Kenney Particle Pack, CC0) ===
    this.load.image('px_light', 'assets/particles/light.png');
    this.load.image('px_smoke', 'assets/particles/smoke.png');
    this.load.image('px_fire', 'assets/particles/fire.png');
    this.load.image('px_spark', 'assets/particles/spark.png');
    this.load.image('px_magic', 'assets/particles/magic.png');
    this.load.image('px_star', 'assets/particles/star.png');
    this.load.image('px_circle', 'assets/particles/circle.png');
    this.load.image('px_muzzle', 'assets/particles/muzzle.png');
    this.load.image('px_flame', 'assets/particles/flame.png');
  }

  create(): void {
    // Generate procedural assets (towers, projectiles, UI)
    generateAssets(this);

    // Pre-build aliased textures so existing keys still work
    aliasTexture(this, 'tile_grass', 'px_grass');
    aliasTexture(this, 'tile_path', 'px_path');
    aliasTexture(this, 'tile_blocked', 'px_water');
    aliasTexture(this, 'tile_spawn', 'px_path');
    aliasTexture(this, 'tile_base', 'px_chest');

    // Map old enemy texture keys to new pixel art
    aliasTexture(this, 'enemy_scout', 'px_enemy_scout');
    aliasTexture(this, 'enemy_soldier', 'px_enemy_soldier');
    aliasTexture(this, 'enemy_knight', 'px_enemy_knight');
    aliasTexture(this, 'enemy_assassin', 'px_enemy_assassin');
    aliasTexture(this, 'enemy_healer', 'px_enemy_healer');
    aliasTexture(this, 'enemy_splitter', 'px_enemy_splitter');
    aliasTexture(this, 'enemy_splitter_mini', 'px_enemy_splitter_mini');
    aliasTexture(this, 'enemy_phantom', 'px_enemy_phantom');
    aliasTexture(this, 'enemy_titan', 'px_enemy_titan');
    aliasTexture(this, 'frog', 'px_frog');

    // Map particles
    aliasTexture(this, 'particle', 'px_light');
    aliasTexture(this, 'particle_smoke', 'px_smoke');
    aliasTexture(this, 'particle_flare', 'px_fire');
    aliasTexture(this, 'particle_spark', 'px_spark');
    aliasTexture(this, 'particle_star', 'px_star');
    aliasTexture(this, 'particle_magic', 'px_magic');
    aliasTexture(this, 'particle_bubble', 'px_circle');
    aliasTexture(this, 'glow', 'px_light');

    this.time.delayedCall(100, () => {
      this.scene.start('MenuScene');
    });
  }
}

/**
 * Make `aliasKey` an alias for `targetKey` if the target is loaded.
 * Falls back gracefully if either is missing.
 */
function aliasTexture(scene: Phaser.Scene, aliasKey: string, targetKey: string): void {
  if (!scene.textures.exists(targetKey)) return;
  // Remove existing texture (procedural fallback)
  if (scene.textures.exists(aliasKey)) {
    scene.textures.remove(aliasKey);
  }
  // Copy frame source from target
  const targetTexture = scene.textures.get(targetKey);
  const source = targetTexture.getSourceImage(0);
  if (source instanceof HTMLImageElement) {
    scene.textures.addImage(aliasKey, source);
  } else if (source instanceof HTMLCanvasElement) {
    scene.textures.addCanvas(aliasKey, source);
  }
}
