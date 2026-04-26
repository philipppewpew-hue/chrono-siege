import * as Phaser from 'phaser';
import { TILE_SIZE, TOWERS, TowerDef, GRID_OFFSET_X, GRID_OFFSET_Y } from '../config';
import { Enemy } from './Enemy';
import { SFX } from '../utils/SoundGenerator';
import { VisualEffects } from '../systems/VisualEffects';

export class Tower extends Phaser.GameObjects.Container {
  public gridX: number;
  public gridY: number;
  public def: TowerDef;
  public level: number = 0; // 0, 1, 2
  public kills: number = 0;
  public totalDamageDealt: number = 0;

  private sprite: Phaser.GameObjects.Image;
  private fireCooldown: number = 0;
  private rangeCircle: Phaser.GameObjects.Graphics;
  private showingRange: boolean = false;
  private vfx: VisualEffects | null = null;
  private soulPower: number = 0; // temporary power boost from soul orbs
  private soulGlow: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, gridX: number, gridY: number, towerId: string) {
    const px = GRID_OFFSET_X + gridX * TILE_SIZE + TILE_SIZE / 2;
    const py = GRID_OFFSET_Y + gridY * TILE_SIZE + TILE_SIZE / 2;
    super(scene, px, py);

    this.gridX = gridX;
    this.gridY = gridY;
    this.def = TOWERS[towerId];

    // Range indicator (hidden by default)
    this.rangeCircle = scene.add.graphics();
    this.rangeCircle.setVisible(false);
    this.drawRangeCircle();

    // Soul power glow
    this.soulGlow = scene.add.graphics();
    this.soulGlow.setVisible(false);

    // Tower sprite
    this.sprite = scene.add.image(0, 0, `tower_${towerId}`);
    this.add(this.sprite);

    // Place animation
    this.setScale(0.5);
    scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    scene.add.existing(this);
  }

  get currentDamage(): number {
    const base = this.def.damage * this.def.damageScale[this.level];
    return base * (1 + this.soulPower * 0.5);
  }

  setVFX(vfx: VisualEffects): void {
    this.vfx = vfx;
  }

  get currentRange(): number {
    const rangeBonus = (this as any)._rangeBonus ?? 0;
    return this.def.range * this.def.rangeScale[this.level] * TILE_SIZE + rangeBonus;
  }

  get currentFireRate(): number {
    return this.def.fireRate * this.def.rateScale[this.level];
  }

  get sellValue(): number {
    let total = this.def.cost;
    for (let i = 0; i < this.level; i++) {
      total += this.def.upgradeCosts[i];
    }
    return Math.floor(total * 0.6);
  }

  get upgradeCost(): number | null {
    if (this.level >= 2) return null;
    return this.def.upgradeCosts[this.level];
  }

  get totalInvested(): number {
    let total = this.def.cost;
    for (let i = 0; i < this.level; i++) {
      total += this.def.upgradeCosts[i];
    }
    return total;
  }

  upgrade(): void {
    if (this.level >= 2) return;
    this.level++;
    const suffix = this.level > 0 ? `_${this.level + 1}` : '';
    this.sprite.setTexture(`tower_${this.def.id}${suffix}`);
    this.drawRangeCircle();

    // Upgrade animation
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    SFX.towerUpgrade();

    if (this.vfx) {
      this.vfx.towerUpgrade(this.x, this.y, this.def.color);
    }
  }

  addSoulPower(amount: number): void {
    this.soulPower = Math.min(this.soulPower + amount, 3);
    this.updateSoulGlow();
  }

  showRange(show: boolean): void {
    this.showingRange = show;
    this.rangeCircle.setVisible(show);
  }

  findTarget(enemies: Enemy[]): Enemy | null {
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    const range = this.currentRange;

    for (const enemy of enemies) {
      if (!enemy.active || enemy.isDead) continue;
      if (enemy.isPhased) continue; // Can't target phased enemies

      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist <= range && dist < closestDist) {
        // Prioritize enemies closest to the base (furthest along path)
        closestDist = dist;
        closest = enemy;
      }
    }

    return closest;
  }

  findEnemiesInRange(enemies: Enemy[], range?: number): Enemy[] {
    const r = range ?? this.currentRange;
    return enemies.filter(e => {
      if (!e.active || e.isDead) return false;
      if (e.isPhased) return false;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      return dist <= r;
    });
  }

  update(time: number, delta: number, enemies: Enemy[], fireCallback: (tower: Tower, target: Enemy) => void): void {
    // Decay soul power
    if (this.soulPower > 0) {
      this.soulPower -= delta / 1000 * 0.3;
      if (this.soulPower <= 0) {
        this.soulPower = 0;
        this.soulGlow.setVisible(false);
      } else {
        this.updateSoulGlow();
      }
    }

    // Fire cooldown
    this.fireCooldown -= delta / 1000;
    if (this.fireCooldown > 0) return;

    const target = this.findTarget(enemies);
    if (!target) return;

    // Rotate tower toward target (subtle)
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    this.sprite.setRotation(angle + Math.PI / 2);

    // Fire!
    this.fireCooldown = 1 / this.currentFireRate;
    fireCallback(this, target);

    // Shoot sound
    const sfxMethod = `shoot_${this.def.id}` as keyof typeof SFX;
    if (SFX[sfxMethod]) {
      (SFX[sfxMethod] as () => void)();
    }

    // Muzzle flash (VFX particles + sprite pulse)
    if (this.vfx) {
      this.vfx.towerFire(this.x, this.y, this.def.color);
    }
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 50,
      yoyo: true,
    });
  }

  private drawRangeCircle(): void {
    this.rangeCircle.clear();
    this.rangeCircle.lineStyle(1.5, this.def.color, 0.4);
    this.rangeCircle.fillStyle(this.def.color, 0.06);
    this.rangeCircle.strokeCircle(this.x, this.y, this.currentRange);
    this.rangeCircle.fillCircle(this.x, this.y, this.currentRange);
  }

  private updateSoulGlow(): void {
    this.soulGlow.clear();
    this.soulGlow.setVisible(this.soulPower > 0);
    if (this.soulPower > 0) {
      const alpha = Math.min(this.soulPower * 0.15, 0.3);
      this.soulGlow.fillStyle(0xaaddff, alpha);
      this.soulGlow.fillCircle(this.x, this.y, TILE_SIZE * 0.6);
    }
  }

  destroyTower(): void {
    this.rangeCircle.destroy();
    this.soulGlow.destroy();
    this.destroy();
  }
}
