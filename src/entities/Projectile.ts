import * as Phaser from 'phaser';
import { TILE_SIZE, TowerDef } from '../config';
import { Enemy } from './Enemy';
import { Tower } from './Tower';
import { VisualEffects } from '../systems/VisualEffects';

export class Projectile extends Phaser.GameObjects.Container {
  public tower: Tower;
  public target: Enemy;
  public damage: number;
  public speed: number;
  public def: TowerDef;
  public isDone: boolean = false;

  private sprite: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    tower: Tower,
    target: Enemy,
    damage: number,
    _vfx?: VisualEffects
  ) {
    super(scene, tower.x, tower.y);

    this.tower = tower;
    this.target = target;
    this.damage = damage;
    this.speed = tower.def.projectileSpeed;
    this.def = tower.def;

    // Projectile sprite with ADD blend for glow
    this.sprite = scene.add.image(0, 0, `proj_${tower.def.id}`);
    this.sprite.setScale(0.8);
    this.sprite.setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.sprite);

    scene.add.existing(this);
  }

  update(delta: number, _enemies: Enemy[], onImpact: (proj: Projectile) => void): void {
    if (this.isDone) return;

    const dt = delta / 1000;

    let tx: number, ty: number;
    if (this.target && this.target.active && !this.target.isDead) {
      tx = this.target.x;
      ty = this.target.y;
    } else {
      this.isDone = true;
      this.cleanup();
      return;
    }

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) {
      this.isDone = true;
      onImpact(this);
      this.cleanup();
      return;
    }

    const moveAmount = this.speed * dt;
    const ratio = Math.min(moveAmount / dist, 1);
    this.x += dx * ratio;
    this.y += dy * ratio;

    this.sprite.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
  }

  cleanup(): void {
    this.destroy();
  }
}

// Impact effect handler — uses VFX system
export function handleProjectileImpact(
  scene: Phaser.Scene,
  proj: Projectile,
  enemies: Enemy[],
  towers: Tower[],
  vfx?: VisualEffects
): void {
  const tower = proj.tower;
  const target = proj.target;
  const def = proj.def;

  if (!target || !target.active || target.isDead) return;

  const killed = target.takeDamage(proj.damage);
  tower.totalDamageDealt += proj.damage;

  // VFX impact
  if (vfx) {
    vfx.projectileImpact(target.x, target.y, def.color, def.id);
  }

  // Splash damage
  if (def.splashRadius && def.splashRadius > 0) {
    const splashRange = def.splashRadius * TILE_SIZE;
    for (const enemy of enemies) {
      if (enemy === target || !enemy.active || enemy.isDead) continue;
      const dist = Phaser.Math.Distance.Between(target.x, target.y, enemy.x, enemy.y);
      if (dist <= splashRange) {
        const falloff = 1 - (dist / splashRange) * 0.5;
        enemy.takeDamage(proj.damage * falloff, true);
      }
    }
    if (vfx) {
      vfx.splashImpact(target.x, target.y, splashRange, def.color);
    }
  }

  // Slow effect
  if (def.slowAmount && def.slowDuration) {
    target.applySlow(def.slowAmount, def.slowDuration);
    if (def.splashRadius) {
      const splashRange = def.splashRadius * TILE_SIZE;
      for (const enemy of enemies) {
        if (enemy === target || !enemy.active || enemy.isDead) continue;
        const dist = Phaser.Math.Distance.Between(target.x, target.y, enemy.x, enemy.y);
        if (dist <= splashRange) {
          enemy.applySlow(def.slowAmount * 0.5, def.slowDuration * 0.5);
        }
      }
    }
  }

  // DoT effect
  if (def.dotDamage && def.dotDuration) {
    target.applyDot(def.dotDamage * tower.def.damageScale[tower.level], def.dotDuration);
  }

  // Chain lightning
  if (def.chainCount && def.chainCount > 0) {
    const chainCount = def.chainCount + (tower.level > 1 ? 1 : 0);
    const chainRange = TILE_SIZE * 2.5;
    let lastEnemy = target;
    const hit = new Set<Enemy>([target]);

    for (let i = 0; i < chainCount; i++) {
      let closest: Enemy | null = null;
      let closestDist = Infinity;

      for (const enemy of enemies) {
        if (hit.has(enemy) || !enemy.active || enemy.isDead) continue;
        const dist = Phaser.Math.Distance.Between(lastEnemy.x, lastEnemy.y, enemy.x, enemy.y);
        if (dist <= chainRange && dist < closestDist) {
          closestDist = dist;
          closest = enemy;
        }
      }

      if (closest) {
        hit.add(closest);
        const chainDamage = proj.damage * (0.7 - i * 0.1);
        closest.takeDamage(chainDamage, true);
        if (vfx) {
          vfx.lightningChain(lastEnemy.x, lastEnemy.y, closest.x, closest.y);
        }
        lastEnemy = closest;
      } else {
        break;
      }
    }
  }

  if (killed) {
    tower.kills++;
  }
}
