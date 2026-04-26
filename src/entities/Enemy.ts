import * as Phaser from 'phaser';
import { TILE_SIZE, ENEMIES, EnemyDef, GRID_OFFSET_X, GRID_OFFSET_Y } from '../config';
import { GridPos } from '../utils/Pathfinding';
import { VisualEffects } from '../systems/VisualEffects';

export class Enemy extends Phaser.GameObjects.Container {
  public def: EnemyDef;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public baseSpeed: number;
  public isDead: boolean = false;
  public reachedBase: boolean = false;
  public pathIndex: number = 0;
  public isPhased: boolean = false;
  public isMini: boolean = false; // for splitter children

  private sprite: Phaser.GameObjects.Image;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private path: GridPos[] = [];
  private slowTimer: number = 0;
  private slowAmount: number = 0;
  private dotTimer: number = 0;
  private dotDamage: number = 0;
  private phaseTimer: number = 0;
  private healTimer: number = 0;
  private dodgeChance: number = 0;
  private vfx: VisualEffects | null = null;
  private statusParticleTimer: number = 0;
  private comboTimer: number = 0;
  private comboHits: number = 0;

  private onDeath: ((enemy: Enemy) => void) | null = null;
  private onReachBase: ((enemy: Enemy) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    enemyType: string,
    path: GridPos[],
    hpScale: number = 1,
    speedScale: number = 1,
    isMini: boolean = false,
    startPathIndex: number = 0
  ) {
    const startPos = path[startPathIndex];
    const px = GRID_OFFSET_X + startPos.x * TILE_SIZE + TILE_SIZE / 2;
    const py = GRID_OFFSET_Y + startPos.y * TILE_SIZE + TILE_SIZE / 2;
    super(scene, px, py);

    this.def = ENEMIES[enemyType];
    this.isMini = isMini;
    this.maxHp = Math.round(this.def.hp * hpScale * (isMini ? 0.4 : 1));
    this.hp = this.maxHp;
    this.baseSpeed = this.def.speed * speedScale * (isMini ? 1.2 : 1);
    this.speed = this.baseSpeed;
    this.path = path;
    this.pathIndex = startPathIndex;

    // Set up special abilities
    if (this.def.special === 'dodge') {
      this.dodgeChance = 0.25;
    }
    if (this.def.special === 'phase') {
      this.phaseTimer = 2 + Math.random() * 3;
    }

    // Sprite
    const texKey = isMini ? `enemy_${enemyType}_mini` : `enemy_${enemyType}`;
    this.sprite = scene.add.image(0, 0, texKey);
    if (isMini) this.sprite.setScale(0.6);
    this.add(this.sprite);

    // HP bar
    this.hpBarBg = scene.add.graphics();
    this.hpBarFill = scene.add.graphics();
    this.updateHpBar();

    // Spawn animation
    this.setAlpha(0);
    scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 300,
    });

    scene.add.existing(this);
  }

  setVFX(vfx: VisualEffects): void {
    this.vfx = vfx;
  }

  setCallbacks(onDeath: (enemy: Enemy) => void, onReachBase: (enemy: Enemy) => void): void {
    this.onDeath = onDeath;
    this.onReachBase = onReachBase;
  }

  takeDamage(amount: number, isSplash: boolean = false): boolean {
    if (this.isDead) return false;

    // Dodge check
    if (this.dodgeChance > 0 && Math.random() < this.dodgeChance && !isSplash) {
      // Show dodge text
      this.showFloatingText('DODGE', 0xcc44cc);
      return false;
    }

    // Armor reduction
    const finalDamage = Math.max(1, amount - this.def.armor);
    this.hp -= finalDamage;

    // Combo tracking
    this.comboHits++;
    this.comboTimer = 0.5;
    if (this.comboHits >= 3) {
      const bonusDamage = finalDamage * 0.2 * (this.comboHits - 2);
      this.hp -= bonusDamage;
    }

    // Hit flash
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.sprite && this.sprite.active) {
        this.sprite.clearTint();
      }
    });

    this.updateHpBar();

    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  applySlow(amount: number, duration: number): void {
    if (amount > this.slowAmount) {
      this.slowAmount = amount;
    }
    this.slowTimer = Math.max(this.slowTimer, duration / 1000);
    this.speed = this.baseSpeed * (1 - this.slowAmount);

    // Tint blue when slowed
    this.sprite.setTint(0x8888ff);
  }

  applyDot(damage: number, duration: number): void {
    this.dotDamage = damage;
    this.dotTimer = Math.max(this.dotTimer, duration / 1000);
    // Tint green when poisoned
    if (this.slowTimer <= 0) {
      this.sprite.setTint(0x88ff88);
    }
  }

  healNearby(enemies: Enemy[]): void {
    for (const e of enemies) {
      if (e === this || e.isDead || !e.active) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (dist < TILE_SIZE * 3) {
        e.hp = Math.min(e.maxHp, e.hp + 2);
        e.updateHpBar();
      }
    }
  }

  update(delta: number, enemies: Enemy[]): void {
    if (this.isDead || this.reachedBase) return;

    const dt = delta / 1000;

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboHits = 0;
      }
    }

    // Slow decay
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowAmount = 0;
        this.speed = this.baseSpeed;
        this.sprite.clearTint();
      }
    }

    // DoT
    if (this.dotTimer > 0) {
      this.dotTimer -= dt;
      this.hp -= this.dotDamage * dt;
      if (this.dotTimer <= 0) {
        this.dotDamage = 0;
        if (this.slowTimer <= 0) this.sprite.clearTint();
      }
      this.updateHpBar();
      if (this.hp <= 0) {
        this.die();
        return;
      }
    }

    // Phase (phantom ability)
    if (this.def.special === 'phase') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.isPhased = !this.isPhased;
        this.phaseTimer = this.isPhased ? 1.5 : 2 + Math.random() * 2;
        this.setAlpha(this.isPhased ? 0.25 : 1);
      }
    }

    // Healer ability
    if (this.def.special === 'healer') {
      this.healTimer -= dt;
      if (this.healTimer <= 0) {
        this.healTimer = 1.0;
        this.healNearby(enemies);
      }
    }

    // Status particle emissions (heavily throttled for performance)
    if (this.vfx) {
      this.statusParticleTimer -= dt;
      if (this.statusParticleTimer <= 0) {
        this.statusParticleTimer = 0.3; // ~3 particles/sec per enemy
        if (this.slowTimer > 0) this.vfx.emitStatus(this.x, this.y, 0x88ddff);
        else if (this.dotTimer > 0) this.vfx.emitStatus(this.x, this.y, 0x66cc66);
        else if (this.isPhased) this.vfx.emitStatus(this.x, this.y, 0x8844aa);
      }
    }

    // Movement along path
    if (this.pathIndex >= this.path.length) {
      this.reachBase();
      return;
    }

    const target = this.path[this.pathIndex];
    const tx = GRID_OFFSET_X + target.x * TILE_SIZE + TILE_SIZE / 2;
    const ty = GRID_OFFSET_Y + target.y * TILE_SIZE + TILE_SIZE / 2;

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.reachBase();
        return;
      }
    } else {
      const moveSpeed = this.speed * dt;
      const ratio = Math.min(moveSpeed / dist, 1);
      this.x += dx * ratio;
      this.y += dy * ratio;

      // Rotate sprite toward movement direction
      const angle = Math.atan2(dy, dx);
      this.sprite.setRotation(angle + Math.PI / 2);
    }

    // Update HP bar position
    this.updateHpBar();
  }

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;

    // Physics debris death effect via VFX system
    if (this.vfx) {
      this.vfx.enemyDeath(this.x, this.y, this.def.color, this.def.id);
    }

    // Quick fade (debris carries the visual weight)
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 100,
      onComplete: () => {
        this.cleanup();
      },
    });

    if (this.onDeath) {
      this.onDeath(this);
    }
  }

  private reachBase(): void {
    if (this.reachedBase) return;
    this.reachedBase = true;

    if (this.vfx) {
      this.vfx.enemyReachBase(this.x, this.y);
    }

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.cleanup();
      },
    });

    if (this.onReachBase) {
      this.onReachBase(this);
    }
  }

  private showFloatingText(text: string, color: number): void {
    const floatText = this.scene.add.text(this.x, this.y - 20, text, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: floatText,
      y: floatText.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => floatText.destroy(),
    });
  }

  updateHpBar(): void {
    const barWidth = 30;
    const barHeight = 4;
    const barY = -TILE_SIZE / 2 - 6;

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x220000, 0.8);
    this.hpBarBg.fillRect(this.x - barWidth / 2, this.y + barY, barWidth, barHeight);

    this.hpBarFill.clear();
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    const color = hpRatio > 0.5 ? 0x00ff44 : hpRatio > 0.25 ? 0xffaa00 : 0xff4400;
    this.hpBarFill.fillStyle(color, 0.9);
    this.hpBarFill.fillRect(
      this.x - barWidth / 2,
      this.y + barY,
      barWidth * hpRatio,
      barHeight
    );
  }

  cleanup(): void {
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.destroy();
  }

  // Get the grid position for path recalculation
  getCurrentGridPos(): GridPos {
    return this.path[Math.min(this.pathIndex, this.path.length - 1)];
  }

  setNewPath(newPath: GridPos[]): void {
    // Find closest point on new path to current position
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < newPath.length; i++) {
      const px = GRID_OFFSET_X + newPath[i].x * TILE_SIZE + TILE_SIZE / 2;
      const py = GRID_OFFSET_Y + newPath[i].y * TILE_SIZE + TILE_SIZE / 2;
      const d = Phaser.Math.Distance.Between(this.x, this.y, px, py);
      if (d < closestDist) {
        closestDist = d;
        closestIdx = i;
      }
    }
    this.path = newPath;
    this.pathIndex = closestIdx;
  }
}
