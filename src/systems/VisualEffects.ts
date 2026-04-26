import * as Phaser from 'phaser';

/**
 * Centralized Visual Effects system — performance-optimized.
 * Uses shared emitters with explode() for one-shot bursts.
 * NO per-projectile emitters. NO continuous ambient emitters.
 */
export class VisualEffects {
  private scene: Phaser.Scene;

  // Shared burst emitters (pre-created, reused via explode())
  private deathDebris!: Phaser.GameObjects.Particles.ParticleEmitter;
  private deathSmoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private impactSpark!: Phaser.GameObjects.Particles.ParticleEmitter;
  private impactFire!: Phaser.GameObjects.Particles.ParticleEmitter;
  private impactFrost!: Phaser.GameObjects.Particles.ParticleEmitter;
  private impactPoison!: Phaser.GameObjects.Particles.ParticleEmitter;
  private impactChrono!: Phaser.GameObjects.Particles.ParticleEmitter;
  private muzzleFlash!: Phaser.GameObjects.Particles.ParticleEmitter;
  private upgradeSparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private statusParticle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private waveBlast!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createEmitters();
  }

  private createEmitters(): void {
    // Debris burst — physics death: pieces fly up and fall
    this.deathDebris = this.scene.add.particles(0, 0, 'particle_square', {
      lifespan: { min: 400, max: 800 },
      speed: { min: 80, max: 220 },
      angle: { min: 200, max: 340 },
      gravityY: 400,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      emitting: false,
    }).setDepth(60);

    // Death smoke puff
    this.deathSmoke = this.scene.add.particles(0, 0, 'particle_smoke', {
      lifespan: { min: 250, max: 500 },
      speed: { min: 15, max: 40 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.3, end: 0.6 },
      alpha: { start: 0.4, end: 0 },
      emitting: false,
    }).setDepth(59);

    // Generic spark impact
    this.impactSpark = this.scene.add.particles(0, 0, 'particle_spark', {
      lifespan: { min: 80, max: 200 },
      speed: { min: 60, max: 160 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    }).setDepth(55).setBlendMode(Phaser.BlendModes.ADD);

    // Cannon/fire explosion
    this.impactFire = this.scene.add.particles(0, 0, 'particle_flare', {
      lifespan: { min: 150, max: 350 },
      speed: { min: 30, max: 100 },
      angle: { min: 0, max: 360 },
      gravityY: 80,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xff8844, 0xff6622, 0xffaa00],
      emitting: false,
    }).setDepth(55).setBlendMode(Phaser.BlendModes.ADD);

    // Frost impact
    this.impactFrost = this.scene.add.particles(0, 0, 'particle_star', {
      lifespan: { min: 200, max: 400 },
      speed: { min: 20, max: 60 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x88ddff, 0x44aaee, 0xffffff],
      emitting: false,
    }).setDepth(55);

    // Poison impact
    this.impactPoison = this.scene.add.particles(0, 0, 'particle_bubble', {
      lifespan: { min: 300, max: 500 },
      speed: { min: 10, max: 40 },
      angle: { min: 220, max: 320 },
      gravityY: -20,
      scale: { start: 0.5, end: 0.8 },
      alpha: { start: 0.5, end: 0 },
      tint: [0x66cc66, 0x88ff88],
      emitting: false,
    }).setDepth(55);

    // Chrono impact
    this.impactChrono = this.scene.add.particles(0, 0, 'particle_magic', {
      lifespan: { min: 200, max: 400 },
      speed: { min: 30, max: 70 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [0xaa44dd, 0xcc88ff],
      emitting: false,
    }).setDepth(55).setBlendMode(Phaser.BlendModes.ADD);

    // Muzzle flash
    this.muzzleFlash = this.scene.add.particles(0, 0, 'particle_flare', {
      lifespan: 100,
      speed: { min: 30, max: 80 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.8, end: 0 },
      emitting: false,
    }).setDepth(55).setBlendMode(Phaser.BlendModes.ADD);

    // Upgrade sparkle
    this.upgradeSparkle = this.scene.add.particles(0, 0, 'particle_star', {
      lifespan: { min: 300, max: 600 },
      speed: { min: 40, max: 100 },
      angle: { min: 200, max: 340 },
      gravityY: 50,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd700, 0xffaa00, 0xffffff],
      emitting: false,
    }).setDepth(60);

    // Shared status particle (for slow/poison/phase/heal — single emitter, tint per call)
    this.statusParticle = this.scene.add.particles(0, 0, 'particle', {
      lifespan: 200,
      speed: { min: 5, max: 15 },
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.5, end: 0 },
      emitting: false,
    }).setDepth(45);

    // Wave start blast
    this.waveBlast = this.scene.add.particles(0, 0, 'particle_flare', {
      lifespan: { min: 400, max: 800 },
      speed: { min: 80, max: 250 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: [0xffaa44, 0xff8822, 0xffd700],
      emitting: false,
    }).setDepth(95).setBlendMode(Phaser.BlendModes.ADD);
  }

  // ============================================================
  // PUBLIC EFFECT METHODS
  // ============================================================

  /** Enemy death with physics debris */
  enemyDeath(x: number, y: number, color: number, enemyType: string): void {
    const isBoss = enemyType === 'titan';

    this.deathDebris.setParticleTint(color);
    this.deathDebris.explode(isBoss ? 18 : 8, x, y);

    this.deathSmoke.setParticleTint(0x444444);
    this.deathSmoke.explode(isBoss ? 6 : 3, x, y);

    this.impactSpark.setParticleTint(color);
    this.impactSpark.explode(isBoss ? 6 : 3, x, y);

    if (isBoss) {
      this.scene.cameras.main.shake(300, 0.012);
      this.scene.cameras.main.flash(200, 255, 100, 0);
    }
  }

  /** Projectile impact — type-specific */
  projectileImpact(x: number, y: number, color: number, towerType: string): void {
    this.impactSpark.setParticleTint(color);
    this.impactSpark.explode(3, x, y);

    switch (towerType) {
      case 'cannon':
        this.impactFire.explode(5, x, y);
        break;
      case 'frost':
        this.impactFrost.explode(4, x, y);
        break;
      case 'lightning':
        this.impactSpark.setParticleTint(0xffff44);
        this.impactSpark.explode(4, x, y);
        break;
      case 'poison':
        this.impactPoison.explode(3, x, y);
        break;
      case 'chrono':
        this.impactChrono.explode(4, x, y);
        break;
    }
  }

  /** Splash damage area effect */
  splashImpact(x: number, y: number, radius: number, color: number): void {
    this.impactFire.explode(6, x, y);

    const ring = this.scene.add.image(x, y, 'particle_ring')
      .setScale(0.2).setTint(color).setAlpha(0.6)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(55);

    this.scene.tweens.add({
      targets: ring,
      scaleX: radius / 16, scaleY: radius / 16, alpha: 0,
      duration: 300, onComplete: () => ring.destroy(),
    });
  }

  /** Tower muzzle flash */
  towerFire(x: number, y: number, color: number): void {
    this.muzzleFlash.setParticleTint(color);
    this.muzzleFlash.explode(2, x, y);
  }

  /** Tower upgrade effect */
  towerUpgrade(x: number, y: number, color: number): void {
    this.upgradeSparkle.explode(8, x, y);

    const ring = this.scene.add.image(x, y, 'glow')
      .setScale(0.3).setTint(color).setAlpha(0.7)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(60);

    this.scene.tweens.add({
      targets: ring, scaleX: 1.2, scaleY: 1.2, alpha: 0,
      duration: 350, onComplete: () => ring.destroy(),
    });
  }

  /** Tower placement effect */
  towerPlace(x: number, y: number): void {
    this.deathSmoke.setParticleTint(0x888888);
    this.deathSmoke.explode(3, x, y);
  }

  /** Lightning chain visual */
  lightningChain(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.scene.add.graphics().setDepth(56);
    const segments = 4;
    const points: { x: number; y: number }[] = [{ x: x1, y: y1 }];

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      points.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 12,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 12,
      });
    }
    points.push({ x: x2, y: y2 });

    g.lineStyle(3, 0xffff88, 0.9);
    for (let i = 0; i < points.length - 1; i++) {
      g.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
    g.lineStyle(5, 0xffff44, 0.25);
    for (let i = 0; i < points.length - 1; i++) {
      g.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    this.impactSpark.setParticleTint(0xffff44);
    this.impactSpark.explode(2, x2, y2);

    this.scene.tweens.add({
      targets: g, alpha: 0, duration: 150,
      onComplete: () => g.destroy(),
    });
  }

  /** Status particle — single particle per call, call sparingly */
  emitStatus(x: number, y: number, color: number): void {
    this.statusParticle.setParticleTint(color);
    this.statusParticle.emitParticleAt(x, y, 1);
  }

  /** Wave start announcement */
  waveStart(x: number, y: number): void {
    this.waveBlast.explode(10, x, y);
  }

  /** Enemy reached the base */
  enemyReachBase(x: number, y: number): void {
    this.scene.cameras.main.shake(200, 0.006);
    this.impactSpark.setParticleTint(0xff4444);
    this.impactSpark.explode(5, x, y);
  }

  destroy(): void {
    this.deathDebris.destroy();
    this.deathSmoke.destroy();
    this.impactSpark.destroy();
    this.impactFire.destroy();
    this.impactFrost.destroy();
    this.impactPoison.destroy();
    this.impactChrono.destroy();
    this.muzzleFlash.destroy();
    this.upgradeSparkle.destroy();
    this.statusParticle.destroy();
    this.waveBlast.destroy();
  }
}
