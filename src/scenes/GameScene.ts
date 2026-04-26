import * as Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, GRID_COLS, GRID_ROWS,
  GRID_OFFSET_X, GRID_OFFSET_Y, STARTING_GOLD, STARTING_LIVES,
  TOWERS, TOWER_ORDER, COLORS,
  GameMode, SpecialistClass, SPECIALISTS,
} from '../config';
import { GridManager, CellType } from '../managers/GridManager';
import { WaveManager } from '../managers/WaveManager';
import { Tower } from '../entities/Tower';
import { Enemy } from '../entities/Enemy';
import { Projectile, handleProjectileImpact } from '../entities/Projectile';
import { GridPos, findPath } from '../utils/Pathfinding';
import { SFX, resumeAudio } from '../utils/SoundGenerator';
import { networkManager, NetEventType } from '../managers/NetworkManager';
import { VisualEffects } from '../systems/VisualEffects';

export class GameScene extends Phaser.Scene {
  // Managers
  private gridManager!: GridManager;
  private waveManager!: WaveManager;

  // Game state
  public gold: number = STARTING_GOLD;
  public lives: number = STARTING_LIVES;
  public gameSpeed: number = 1;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public isVictory: boolean = false;

  // Entities
  private towers: Tower[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];

  // UI state
  private selectedTowerId: string | null = null;
  private selectedTower: Tower | null = null;
  private ghostTower: Phaser.GameObjects.Image | null = null;
  private rangePreview: Phaser.GameObjects.Graphics | null = null;
  private placementValid: boolean = false;

  // Time warp ability
  private timeWarpCooldown: number = 0;
  private timeWarpActive: boolean = false;
  private timeWarpDuration: number = 0;
  private timeWarpOverlay: Phaser.GameObjects.Graphics | null = null;

  // Visual effects system
  public vfx!: VisualEffects;

  // Multiplayer
  private isMultiplayer: boolean = false;
  private spawnCounter: number = 0; // deterministic spawn selection
  private peerCursor: Phaser.GameObjects.Graphics | null = null;
  private peerCursorLabel: Phaser.GameObjects.Text | null = null;
  private connectionLabel: Phaser.GameObjects.Text | null = null;
  private goldSyncTimer: number = 0;

  // Mode + class state
  public gameMode: GameMode = 'solo';
  public myClass: SpecialistClass = 'commander';
  public peerClass: SpecialistClass = 'commander';

  // Specialist ability (replaces Time Warp)
  private abilityCooldown: number = 0;
  private abilityActive: boolean = false;
  private abilityActiveTimer: number = 0;
  private rallyMultiplier: number = 1; // commander rally
  private reinforceBonus: number = 0;  // architect range bonus
  private placingMeteor: boolean = false; // sorcerer

  // Send Mode
  private killStreak: number = 0;
  private killStreakTimer: number = 0;
  private peerLives: number = STARTING_LIVES;
  private incomingEnemies: { type: string; hpScale: number }[] = [];
  private sendStatusText: Phaser.GameObjects.Text | null = null;

  // Split Lanes
  private goldP1: number = STARTING_GOLD;
  private goldP2: number = STARTING_GOLD;
  private livesP1: number = STARTING_LIVES;
  private livesP2: number = STARTING_LIVES;
  private giftBtn: Phaser.GameObjects.Container | null = null;
  private peerGoldText: Phaser.GameObjects.Text | null = null;
  private peerLivesText: Phaser.GameObjects.Text | null = null;

  // HUD elements
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private waveTimerText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private towerButtons: Phaser.GameObjects.Container[] = [];
  private infoPanel!: Phaser.GameObjects.Container;
  private towerInfoTexts: Record<string, Phaser.GameObjects.Text> = {};
  private timeWarpBtn!: Phaser.GameObjects.Container;
  private timeWarpCooldownText!: Phaser.GameObjects.Text;
  private startWaveBtn!: Phaser.GameObjects.Container;
  private wavePreviewTexts: Phaser.GameObjects.Text[] = [];
  private upgradeBtn: Phaser.GameObjects.Container | null = null;
  private sellBtn: Phaser.GameObjects.Container | null = null;
  private frogSprite: Phaser.GameObjects.Image | null = null;
  private frogTimer: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    resumeAudio();

    // Reset state
    this.gold = STARTING_GOLD;
    this.lives = STARTING_LIVES;
    this.gameSpeed = 1;
    this.isPaused = false;
    this.isGameOver = false;
    this.isVictory = false;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.selectedTowerId = null;
    this.selectedTower = null;
    this.timeWarpCooldown = 0;
    this.timeWarpActive = false;
    this.spawnCounter = 0;
    this.goldSyncTimer = 0;
    this.abilityCooldown = 0;
    this.abilityActive = false;
    this.abilityActiveTimer = 0;
    this.rallyMultiplier = 1;
    this.reinforceBonus = 0;
    this.placingMeteor = false;
    this.killStreak = 0;
    this.killStreakTimer = 0;
    this.incomingEnemies = [];
    this.peerLives = STARTING_LIVES;
    this.goldP1 = STARTING_GOLD;
    this.goldP2 = STARTING_GOLD;
    this.livesP1 = STARTING_LIVES;
    this.livesP2 = STARTING_LIVES;

    // Multiplayer setup
    this.isMultiplayer = networkManager.isMultiplayer && networkManager.isConnected;
    this.gameMode = networkManager.isMultiplayer ? networkManager.gameMode : 'solo';
    this.myClass = networkManager.myClass || 'commander';
    this.peerClass = networkManager.peerClass || 'commander';

    // Initialize managers
    this.gridManager = new GridManager(this);
    this.waveManager = new WaveManager();
    this.waveManager.setCallbacks(
      this.spawnEnemy.bind(this),
      this.onWaveComplete.bind(this),
      this.onVictory.bind(this)
    );

    // Visual effects system
    this.vfx = new VisualEffects(this);

    // Camera post-processing — subtle glow/bloom only, no vignette
    try {
      this.cameras.main.filters.external.addGlow(0xffffff, 0.3, 0, 1, false, 3, 3);
    } catch (_) { /* WebGL filters may not be available in Canvas mode */ }

    // Create UI
    this.createHUD();
    this.createTowerPanel();
    this.createInfoPanel();
    this.createActionButtons();
    this.createTimeWarpButton();
    this.createGiftButton();
    this.createSpeedControls();
    this.createStartWaveButton();

    // Multiplayer UI
    if (this.isMultiplayer) {
      this.setupMultiplayerUI();
      this.setupNetworkListeners();
    }

    // Input
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.keyboard!.on('keydown', this.onKeyDown, this);
    this.input.mouse!.disableContextMenu();

    // Fade in
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.updateUI();
    this.updateWavePreview();
  }

  update(time: number, delta: number): void {
    if (this.isPaused || this.isGameOver) return;

    const scaledDelta = delta * this.gameSpeed;

    // Time warp
    if (this.timeWarpActive) {
      this.timeWarpDuration -= delta;
      if (this.timeWarpDuration <= 0) {
        this.timeWarpActive = false;
        if (this.timeWarpOverlay) {
          this.tweens.add({
            targets: this.timeWarpOverlay,
            alpha: 0,
            duration: 500,
            onComplete: () => { this.timeWarpOverlay?.destroy(); this.timeWarpOverlay = null; },
          });
        }
      }
    }

    if (this.timeWarpCooldown > 0) {
      this.timeWarpCooldown -= delta;
      this.updateTimeWarpUI();
    }

    // Specialist ability cooldown + active timer
    if (this.abilityCooldown > 0) {
      this.abilityCooldown -= delta;
      if (this.abilityCooldown <= 0) this.abilityCooldown = 0;
    }
    if (this.abilityActive) {
      this.abilityActiveTimer -= delta;
      if (this.abilityActiveTimer <= 0) {
        this.abilityActive = false;
        this.rallyMultiplier = 1;
        this.reinforceBonus = 0;
        for (const t of this.towers) (t as any)._rangeBonus = 0;
      }
    }
    this.updateAbilityUI();

    // Send mode kill streak decay
    if (this.killStreakTimer > 0) {
      this.killStreakTimer -= delta / 1000;
      if (this.killStreakTimer <= 0) this.killStreak = 0;
    }

    // Wave manager
    this.waveManager.update(scaledDelta);

    // Update enemies
    const enemyDelta = this.timeWarpActive ? scaledDelta * 0.3 : scaledDelta;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.active) {
        this.enemies.splice(i, 1);
        continue;
      }
      enemy.update(enemyDelta, this.enemies);
    }

    // Update towers (rally doubles fire rate via faster delta)
    const towerDelta = scaledDelta * this.rallyMultiplier;
    for (const tower of this.towers) {
      tower.update(time, towerDelta, this.enemies, this.fireTower.bind(this));
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.isDone) {
        this.projectiles.splice(i, 1);
        continue;
      }
      proj.update(scaledDelta, this.enemies, (p) => {
        handleProjectileImpact(this, p, this.enemies, this.towers, this.vfx);
      });
    }

    // Multiplayer: host periodically syncs gold/lives
    if (this.isMultiplayer && networkManager.isHost) {
      this.goldSyncTimer += delta;
      if (this.goldSyncTimer > 2000) {
        this.goldSyncTimer = 0;
        networkManager.send(NetEventType.GOLD_SYNC, { gold: this.gold, lives: this.lives });
      }
    }

    // Frog easter egg
    this.frogTimer -= delta;
    if (this.frogTimer <= 0 && !this.frogSprite) {
      this.frogTimer = 20000 + Math.random() * 40000;
      if (Math.random() < 0.25) this.spawnFrog();
    }

    this.updateUI();
  }

  // ========================
  // MODE / CLASS HELPERS
  // ========================

  /** Effective tower cost based on my specialist class */
  private getTowerCost(towerId: string): number {
    const def = TOWERS[towerId];
    const mult = SPECIALISTS[this.myClass].towerCostMultiplier;
    return Math.floor(def.cost * mult);
  }

  /** Effective tower upgrade cost */
  private getUpgradeCost(tower: Tower): number | null {
    const cost = tower.upgradeCost;
    if (cost === null) return null;
    return Math.floor(cost * SPECIALISTS[this.myClass].towerCostMultiplier);
  }

  /** My current gold (handles per-player split for split-lanes/send) */
  private get myGold(): number {
    if (this.gameMode === 'splitlanes') {
      return networkManager.playerNumber === 2 ? this.goldP2 : this.goldP1;
    }
    return this.gold;
  }
  private addGold(amount: number): void {
    if (this.gameMode === 'splitlanes') {
      if (networkManager.playerNumber === 2) this.goldP2 += amount;
      else this.goldP1 += amount;
    } else {
      this.gold += amount;
    }
  }
  private spendGold(amount: number): void {
    this.addGold(-amount);
  }

  /** My current lives (handles split modes) */
  private get myLives(): number {
    if (this.gameMode === 'splitlanes') {
      return networkManager.playerNumber === 2 ? this.livesP2 : this.livesP1;
    }
    return this.lives;
  }
  private subtractLives(amount: number, ownerPlayer?: number): void {
    if (this.gameMode === 'splitlanes') {
      const target = ownerPlayer ?? networkManager.playerNumber ?? 1;
      if (target === 2) this.livesP2 = Math.max(0, this.livesP2 - amount);
      else this.livesP1 = Math.max(0, this.livesP1 - amount);
    } else {
      this.lives = Math.max(0, this.lives - amount);
    }
  }

  // ========================
  // MULTIPLAYER SETUP
  // ========================

  private setupMultiplayerUI(): void {
    // Peer cursor (shows where the other player is pointing)
    this.peerCursor = this.add.graphics().setDepth(200);
    this.peerCursorLabel = this.add.text(0, 0, networkManager.isHost ? 'P2' : 'P1', {
      fontSize: '10px', fontFamily: 'monospace',
      color: networkManager.isHost ? '#44ff88' : '#44aaff',
      fontStyle: 'bold',
    }).setDepth(200).setVisible(false);

    // Connection indicator with mode and class
    const pNum = networkManager.playerNumber;
    const pColor = pNum === 1 ? '#44aaff' : '#44ff88';
    const mode = this.gameMode.toUpperCase();
    const className = SPECIALISTS[this.myClass].name.toUpperCase();

    this.connectionLabel = this.add.text(GAME_WIDTH - 16, 12, `${mode} • P${pNum} ${className}`, {
      fontSize: '11px', fontFamily: 'monospace', color: pColor, fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(81);

    // Send mode: show peer's lives
    if (this.gameMode === 'send') {
      this.peerLivesText = this.add.text(GAME_WIDTH - 16, 28, `OPP: ${this.peerLives}`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#ff8888',
      }).setOrigin(1, 0).setDepth(81);
    }

    // Split lanes: show peer's gold and lives
    if (this.gameMode === 'splitlanes') {
      const peerGold = networkManager.playerNumber === 2 ? this.goldP1 : this.goldP2;
      const peerLives = networkManager.playerNumber === 2 ? this.livesP1 : this.livesP2;
      const peerNum = networkManager.playerNumber === 2 ? 1 : 2;
      this.peerGoldText = this.add.text(GAME_WIDTH - 16, 28, `P${peerNum}: ${peerGold}g  ${peerLives}♥`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#aabbcc',
      }).setOrigin(1, 0).setDepth(81);
    }

    // Handle disconnect
    networkManager.onDisconnected = () => {
      if (this.connectionLabel) {
        this.connectionLabel.setText('DISCONNECTED').setColor('#ff4444');
      }
      this.isMultiplayer = false;
    };
  }

  private setupNetworkListeners(): void {
    // Receive tower placement from peer
    networkManager.on(NetEventType.TOWER_PLACE, (event) => {
      const { x, y, towerId, player } = event.data;
      this.executeTowerPlace(x, y, towerId, player);
    });

    // Receive tower upgrade from peer
    networkManager.on(NetEventType.TOWER_UPGRADE, (event) => {
      const { x, y } = event.data;
      const tower = this.towers.find(t => t.gridX === x && t.gridY === y);
      if (tower) {
        const cost = tower.upgradeCost;
        if (cost !== null) {
          this.gold -= cost;
          tower.upgrade();
        }
      }
    });

    // Receive tower sell from peer
    networkManager.on(NetEventType.TOWER_SELL, (event) => {
      const { x, y } = event.data;
      const tower = this.towers.find(t => t.gridX === x && t.gridY === y);
      if (tower) {
        this.executeTowerSell(tower, false);
      }
    });

    // Receive wave start from peer
    networkManager.on(NetEventType.WAVE_START, () => {
      this.executeWaveStart(false);
    });

    // Receive time warp from peer
    networkManager.on(NetEventType.TIME_WARP, () => {
      this.executeTimeWarp(false);
    });

    // Receive speed change from peer
    networkManager.on(NetEventType.SPEED_CHANGE, (event) => {
      this.gameSpeed = event.data.speed;
      this.updateSpeedUI();
    });

    // Gold/lives sync from host (guest only)
    if (!networkManager.isHost) {
      networkManager.on(NetEventType.GOLD_SYNC, (event) => {
        this.gold = event.data.gold;
        this.lives = event.data.lives;
      });
    }

    // Game over from host
    networkManager.on(NetEventType.GAME_OVER, (event) => {
      if (event.data.victory) {
        this.onVictory();
      } else {
        this.onDefeat();
      }
    });

    // Peer cursor movement
    networkManager.on(NetEventType.CURSOR_MOVE, (event) => {
      const { x, y } = event.data;
      this.updatePeerCursor(x, y);
    });

    // Send Mode: receive enemies from opponent
    networkManager.on(NetEventType.SEND_ENEMY, (event) => {
      this.receiveSentEnemy(event.data.type);
    });

    // Send Mode: peer's lives update (for UI display)
    networkManager.on(NetEventType.SEND_LIVES_UPDATE, (event) => {
      this.peerLives = event.data.lives;
    });

    // Send Mode: opponent lost
    networkManager.on(NetEventType.SEND_GAME_OVER, () => {
      // Opponent lost, we win
      this.onVictory();
    });

    // Split Lanes: receive gift gold
    networkManager.on(NetEventType.GIFT_GOLD, (event) => {
      this.receiveGiftGold(event.data.amount);
    });

    // Specialist ability sync
    networkManager.on(NetEventType.ABILITY_USE, (event) => {
      // Just visual notification — actual effects are local-only
      this.showAbilityText(`P${event.player}: ${event.data.name}`, 0xaabbcc);
    });
  }

  private updatePeerCursor(x: number, y: number): void {
    if (!this.peerCursor || !this.peerCursorLabel) return;

    const color = networkManager.isHost ? 0x44ff88 : 0x44aaff;
    this.peerCursor.clear();
    this.peerCursor.lineStyle(2, color, 0.7);
    this.peerCursor.strokeCircle(x, y, 12);
    this.peerCursor.fillStyle(color, 0.15);
    this.peerCursor.fillCircle(x, y, 12);

    this.peerCursorLabel.setPosition(x + 14, y - 14).setVisible(true);
  }

  // ========================
  // SPAWNING (deterministic)
  // ========================

  private spawnEnemy(type: string, hpScale: number, speedScale: number): void {
    // Use deterministic spawn selection instead of random
    const spawnIndex = this.spawnCounter % this.gridManager.spawnPoints.length;
    this.spawnCounter++;

    const path = this.gridManager.getPathForSpawn(spawnIndex);
    if (!path) return;

    const enemy = new Enemy(this, type, path, hpScale, speedScale);
    enemy.setVFX(this.vfx);
    enemy.setCallbacks(
      this.onEnemyDeath.bind(this),
      this.onEnemyReachBase.bind(this)
    );

    // Split lanes: assign enemy to player based on spawn index (0=P1, 1=middle, 2=P2)
    if (this.gameMode === 'splitlanes') {
      const ownerPlayer = spawnIndex === 0 ? 1 : spawnIndex === 2 ? 2 : (this.spawnCounter % 2) + 1;
      (enemy as any)._lanePlayer = ownerPlayer;
      // Tint enemy slightly based on lane owner
      const tint = ownerPlayer === 1 ? 0xaaccff : 0xaaffcc;
      enemy['sprite']?.setTint(tint);
    }

    this.enemies.push(enemy);
  }

  private spawnSplitEnemy(parent: Enemy): void {
    const currentPos = parent.getCurrentGridPos();
    for (const base of this.gridManager.basePoints) {
      const path = findPath(
        this.gridManager.grid, currentPos, base, GRID_COLS, GRID_ROWS
      );
      if (path) {
        for (let i = 0; i < 2; i++) {
          const mini = new Enemy(this, 'splitter', path, 1, 1, true);
          mini.x = parent.x + (i === 0 ? -10 : 10);
          mini.y = parent.y + (i === 0 ? -10 : 10);
          mini.setVFX(this.vfx);
          mini.setCallbacks(
            this.onEnemyDeath.bind(this),
            this.onEnemyReachBase.bind(this)
          );
          this.enemies.push(mini);
        }
        return;
      }
    }
  }

  // ========================
  // COMBAT
  // ========================

  private fireTower(tower: Tower, target: Enemy): void {
    // Apply class damage multiplier and active rally
    const classMult = (tower as any)._classDamageMult ?? 1;
    const damage = tower.currentDamage * classMult * this.rallyMultiplier;
    const proj = new Projectile(this, tower, target, damage, this.vfx);
    this.projectiles.push(proj);
  }

  private onEnemyDeath(enemy: Enemy): void {
    if (enemy.isDead) {
      const baseReward = enemy.isMini ? Math.floor(enemy.def.reward * 0.3) : enemy.def.reward;
      // Scout class earns more gold
      const goldMult = SPECIALISTS[this.myClass].goldMultiplier;
      const reward = Math.floor(baseReward * goldMult);
      this.addGold(reward);
      SFX.enemyDeath();
      SFX.goldEarned();

      this.showFloatingGold(enemy.x, enemy.y, reward);
      this.spawnSoulOrb(enemy.x, enemy.y);

      // Send mode: track kill streak, send extras to opponent
      if (this.gameMode === 'send' && this.isMultiplayer && !enemy.isMini) {
        this.killStreak++;
        this.killStreakTimer = 3.0; // 3 seconds to chain kills
        if (this.killStreak >= 5) {
          this.sendEnemyToOpponent(enemy.def.id);
          this.killStreak = 0;
        }
      }

      if (enemy.def.special === 'split' && !enemy.isMini) {
        this.spawnSplitEnemy(enemy);
      }

      this.waveManager.enemyHandled();
    }
  }

  private onEnemyReachBase(enemy: Enemy): void {
    // In split lanes, lives belong to specific player based on enemy lane
    const targetPlayer = (enemy as any)._lanePlayer;
    if (this.gameMode === 'splitlanes' && targetPlayer) {
      this.subtractLives(enemy.def.liveCost, targetPlayer);
    } else {
      this.subtractLives(enemy.def.liveCost);
    }
    SFX.enemyReachBase();

    this.cameras.main.shake(200, 0.005);

    this.tweens.add({
      targets: this.livesText,
      scaleX: 1.5, scaleY: 1.5,
      duration: 100, yoyo: true,
    });

    this.waveManager.enemyHandled();

    // Check defeat
    if (this.gameMode === 'send' && this.isMultiplayer) {
      // Send mode: own lives only matter for me
      if (this.lives <= 0) {
        this.lives = 0;
        networkManager.send(NetEventType.SEND_GAME_OVER, { loser: networkManager.playerNumber });
        this.onDefeat();
      } else {
        // Update peer with my lives
        networkManager.send(NetEventType.SEND_LIVES_UPDATE, { lives: this.lives });
      }
    } else if (this.gameMode === 'splitlanes' && this.isMultiplayer) {
      // Split lanes: lose if MY lives hit 0
      if (this.myLives <= 0) {
        if (networkManager.isHost) {
          networkManager.send(NetEventType.GAME_OVER, { victory: false });
        }
        this.onDefeat();
      }
    } else {
      if (this.lives <= 0) {
        this.lives = 0;
        if (this.isMultiplayer && networkManager.isHost) {
          networkManager.send(NetEventType.GAME_OVER, { victory: false });
        }
        this.onDefeat();
      }
    }
  }

  private spawnSoulOrb(x: number, y: number): void {
    let closestTower: Tower | null = null;
    let closestDist = TILE_SIZE * 5;

    for (const tower of this.towers) {
      const dist = Phaser.Math.Distance.Between(x, y, tower.x, tower.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestTower = tower;
      }
    }

    if (!closestTower) return;

    const orb = this.add.image(x, y, 'soul_orb').setScale(0.8).setAlpha(0.8);
    const targetTower = closestTower;

    this.tweens.add({
      targets: orb,
      x: targetTower.x, y: targetTower.y,
      scaleX: 0.3, scaleY: 0.3, alpha: 0,
      duration: 600, ease: 'Quad.easeIn',
      onComplete: () => {
        targetTower.addSoulPower(0.5);
        orb.destroy();
      },
    });
  }

  // ========================
  // WAVE EVENTS
  // ========================

  private onWaveComplete(waveNum: number, bonusGold: number): void {
    this.gold += bonusGold;

    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, `Wave ${waveNum} Complete!`, {
      fontSize: '28px', fontFamily: 'monospace', color: '#88ccff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(100);

    const bonusMsg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `+${bonusGold} Gold`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffd700',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: [msg, bonusMsg], alpha: 0, y: '-=40',
      duration: 2000, delay: 1000,
      onComplete: () => { msg.destroy(); bonusMsg.destroy(); },
    });

    this.updateWavePreview();

    if (this.startWaveBtn) {
      this.startWaveBtn.setVisible(true);
    }
  }

  private onVictory(): void {
    this.isVictory = true;
    this.isGameOver = true;
    SFX.victory();

    // Golden bloom
    this.cameras.main.flash(500, 255, 215, 0);
    try {
      this.cameras.main.filters.external.addGlow(0xffd700, 2, 0, 1, false, 4, 4);
    } catch (_) { /* Canvas fallback */ }

    if (this.isMultiplayer && networkManager.isHost) {
      networkManager.send(NetEventType.GAME_OVER, { victory: true });
    }

    this.time.delayedCall(1000, () => {
      networkManager.disconnect();
      this.scene.start('GameOverScene', { victory: true, wave: this.waveManager.currentWave, lives: this.lives });
    });
  }

  private onDefeat(): void {
    this.isGameOver = true;
    SFX.defeat();

    this.cameras.main.flash(500, 255, 0, 0);

    // Cinematic defeat: blur + slow zoom
    try {
      const deathBlur = this.cameras.main.filters.external.addBlur(2, 0, 0, 0);
      this.tweens.add({ targets: deathBlur, strength: 2, duration: 1500 });
      this.cameras.main.zoomTo(1.1, 1500);
    } catch (_) { /* Canvas fallback */ }

    this.time.delayedCall(1500, () => {
      networkManager.disconnect();
      this.scene.start('GameOverScene', { victory: false, wave: this.waveManager.currentWave, lives: 0 });
    });
  }

  // ========================
  // INPUT
  // ========================

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isGameOver) return;

    // Send cursor position to peer
    if (this.isMultiplayer) {
      networkManager.send(NetEventType.CURSOR_MOVE, { x: pointer.x, y: pointer.y });
    }

    if (this.selectedTowerId && this.ghostTower) {
      const gridPos = this.gridManager.worldToGrid(pointer.x, pointer.y);
      if (gridPos) {
        const wx = GRID_OFFSET_X + gridPos.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = GRID_OFFSET_Y + gridPos.y * TILE_SIZE + TILE_SIZE / 2;
        this.ghostTower.setPosition(wx, wy);
        this.ghostTower.setVisible(true);

        this.placementValid = this.gridManager.canPlace(gridPos.x, gridPos.y);
        this.ghostTower.setTint(this.placementValid ? 0x44ff44 : 0xff4444);

        if (this.rangePreview) {
          this.rangePreview.clear();
          const def = TOWERS[this.selectedTowerId];
          const range = def.range * TILE_SIZE;
          this.rangePreview.lineStyle(1, def.color, this.placementValid ? 0.4 : 0.2);
          this.rangePreview.fillStyle(def.color, this.placementValid ? 0.08 : 0.04);
          this.rangePreview.strokeCircle(wx, wy, range);
          this.rangePreview.fillCircle(wx, wy, range);
        }
      } else {
        this.ghostTower.setVisible(false);
        if (this.rangePreview) this.rangePreview.clear();
      }
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isGameOver) return;
    resumeAudio();

    if (pointer.rightButtonDown()) {
      this.placingMeteor = false;
      this.cancelSelection();
      return;
    }

    if (!pointer.leftButtonDown()) return;

    // Sorcerer Meteor placement (anywhere on map)
    if (this.placingMeteor) {
      const gridPos = this.gridManager.worldToGrid(pointer.x, pointer.y);
      if (gridPos) {
        this.dropMeteor(pointer.x, pointer.y);
      }
      return;
    }

    const gridPos = this.gridManager.worldToGrid(pointer.x, pointer.y);

    if (gridPos) {
      if (this.selectedTowerId) {
        this.tryPlaceTower(gridPos);
      } else {
        this.selectPlacedTower(gridPos);
      }
    }
  }

  private onPointerUp(_pointer: Phaser.Input.Pointer): void {}

  private onKeyDown(event: KeyboardEvent): void {
    if (this.isGameOver) return;

    const num = parseInt(event.key);
    if (num >= 1 && num <= 6) {
      const towerId = TOWER_ORDER[num - 1];
      if (towerId) this.selectTowerType(towerId);
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'escape':
        this.cancelSelection();
        break;
      case ' ':
        event.preventDefault();
        if (!this.waveManager.isWaveActive && this.waveManager.currentWave < this.waveManager.totalWaves) {
          this.startWave();
        }
        break;
      case 't':
      case 'q':
        this.activateAbility();
        break;
      case 'u':
        if (this.selectedTower) this.upgradeTower(this.selectedTower);
        break;
      case 's':
        if (event.key === 's' && this.selectedTower) this.sellTower(this.selectedTower);
        break;
      case ',':
        this.setGameSpeed(Math.max(0.5, this.gameSpeed - 0.5));
        break;
      case '.':
        this.setGameSpeed(Math.min(3, this.gameSpeed + 0.5));
        break;
      case 'g':
        if (this.gameMode === 'splitlanes' && this.isMultiplayer) this.giftGold();
        break;
    }
  }

  // ========================
  // TOWER ACTIONS (with network sync)
  // ========================

  private selectTowerType(towerId: string): void {
    const def = TOWERS[towerId];
    if (this.gold < def.cost) {
      SFX.cantPlace();
      return;
    }

    if (this.selectedTower) {
      this.selectedTower.showRange(false);
      this.selectedTower = null;
    }

    this.selectedTowerId = towerId;
    SFX.uiClick();

    if (this.ghostTower) this.ghostTower.destroy();
    this.ghostTower = this.add.image(-100, -100, `tower_${towerId}`).setAlpha(0.6).setDepth(50);

    if (!this.rangePreview) {
      this.rangePreview = this.add.graphics().setDepth(49);
    }

    this.updateTowerButtons();
    this.updateInfoForTowerType(towerId);
  }

  private cancelSelection(): void {
    this.selectedTowerId = null;
    if (this.ghostTower) { this.ghostTower.destroy(); this.ghostTower = null; }
    if (this.rangePreview) this.rangePreview.clear();
    if (this.selectedTower) { this.selectedTower.showRange(false); this.selectedTower = null; }
    if (this.upgradeBtn) this.upgradeBtn.setVisible(false);
    if (this.sellBtn) this.sellBtn.setVisible(false);
    this.updateTowerButtons();
    this.clearInfoPanel();
  }

  private tryPlaceTower(gridPos: GridPos): void {
    if (!this.selectedTowerId) return;

    const cost = this.getTowerCost(this.selectedTowerId);
    if (this.myGold < cost) { SFX.cantPlace(); return; }
    if (!this.gridManager.canPlace(gridPos.x, gridPos.y)) { SFX.cantPlace(); return; }

    // Execute locally
    this.executeTowerPlace(gridPos.x, gridPos.y, this.selectedTowerId, networkManager.playerNumber || 1, true);

    // Send to peer (skip in send mode — independent games)
    if (this.isMultiplayer && this.gameMode !== 'send') {
      networkManager.send(NetEventType.TOWER_PLACE, {
        x: gridPos.x, y: gridPos.y,
        towerId: this.selectedTowerId,
        player: networkManager.playerNumber,
      });
    }

    // Keep tower selected for rapid placement if enough gold
    if (this.myGold < cost) {
      this.cancelSelection();
    }

    this.updateUI();
  }

  private executeTowerPlace(x: number, y: number, towerId: string, player: number, isLocal: boolean = false): void {
    if (!this.gridManager.canPlace(x, y)) return;

    this.gridManager.placeTower(x, y);
    const tower = new Tower(this, x, y, towerId);
    tower.setVFX(this.vfx);
    (tower as any)._placedBy = player;

    // Apply specialist class modifier (use placer's class)
    const placerClass = (player === networkManager.playerNumber || !this.isMultiplayer)
      ? this.myClass : this.peerClass;
    const placerSpec = SPECIALISTS[placerClass];
    (tower as any)._classDamageMult = placerSpec.damageMultiplier;

    this.towers.push(tower);

    // Deduct gold only on the local player's placement
    if (isLocal) {
      this.spendGold(this.getTowerCost(towerId));
    }

    SFX.towerPlace();
    this.vfx.towerPlace(tower.x, tower.y);
    this.updateEnemyPaths();
    this.updateUI();
  }

  private selectPlacedTower(gridPos: GridPos): void {
    if (this.selectedTower) this.selectedTower.showRange(false);

    const tower = this.towers.find(t => t.gridX === gridPos.x && t.gridY === gridPos.y);
    if (tower) {
      this.selectedTower = tower;
      tower.showRange(true);
      this.updateInfoForPlacedTower(tower);
      if (this.upgradeBtn) this.upgradeBtn.setVisible(true);
      if (this.sellBtn) this.sellBtn.setVisible(true);
      SFX.uiClick();
    } else {
      this.selectedTower = null;
      this.clearInfoPanel();
      if (this.upgradeBtn) this.upgradeBtn.setVisible(false);
      if (this.sellBtn) this.sellBtn.setVisible(false);
    }
  }

  private upgradeTower(tower: Tower): void {
    const cost = tower.upgradeCost;
    if (cost === null || this.gold < cost) { SFX.cantPlace(); return; }

    this.gold -= cost;
    tower.upgrade();
    this.updateInfoForPlacedTower(tower);
    this.updateUI();

    if (this.isMultiplayer) {
      networkManager.send(NetEventType.TOWER_UPGRADE, { x: tower.gridX, y: tower.gridY });
    }
  }

  private sellTower(tower: Tower): void {
    this.executeTowerSell(tower, true);
  }

  private executeTowerSell(tower: Tower, sendNetwork: boolean): void {
    const value = tower.sellValue;
    this.gold += value;

    this.gridManager.removeTower(tower.gridX, tower.gridY);
    const idx = this.towers.indexOf(tower);
    if (idx >= 0) this.towers.splice(idx, 1);

    if (sendNetwork && this.isMultiplayer) {
      networkManager.send(NetEventType.TOWER_SELL, { x: tower.gridX, y: tower.gridY });
    }

    tower.destroyTower();
    this.selectedTower = null;
    this.clearInfoPanel();
    this.updateEnemyPaths();
    this.updateUI();

    SFX.towerSell();
    this.showFloatingGold(tower.x, tower.y, value);
  }

  private updateEnemyPaths(): void {
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.isDead || enemy.reachedBase) continue;
      const currentGridPos = enemy.getCurrentGridPos();
      for (const base of this.gridManager.basePoints) {
        const newPath = findPath(
          this.gridManager.grid, currentGridPos, base, GRID_COLS, GRID_ROWS
        );
        if (newPath) {
          enemy.setNewPath(newPath);
          break;
        }
      }
    }
  }

  // ========================
  // TIME WARP (with network sync)
  // ========================

  private activateTimeWarp(): void {
    if (this.timeWarpCooldown > 0 || this.timeWarpActive) return;

    this.executeTimeWarp(true);
  }

  // ========================
  // SPECIALIST ABILITIES
  // ========================

  /** Activate the local player's specialist ability (replaces time warp in MP) */
  private activateAbility(): void {
    if (this.abilityCooldown > 0 || this.abilityActive) return;

    const spec = SPECIALISTS[this.myClass];

    switch (spec.abilityKey) {
      case 'rally':
        this.abilityActive = true;
        this.abilityActiveTimer = 6000;
        this.rallyMultiplier = 2;
        this.abilityCooldown = spec.abilityCooldown;
        SFX.timeWarp();
        this.cameras.main.flash(200, 200, 100, 50);
        this.showAbilityText('RALLY!', 0xcc6644);
        break;

      case 'reinforce':
        this.abilityActive = true;
        this.abilityActiveTimer = 8000;
        this.reinforceBonus = TILE_SIZE * 1.5;
        // Apply to all towers
        for (const t of this.towers) {
          (t as any)._rangeBonus = this.reinforceBonus;
        }
        this.abilityCooldown = spec.abilityCooldown;
        SFX.towerUpgrade();
        this.showAbilityText('REINFORCE!', 0x88aacc);
        break;

      case 'meteor':
        this.placingMeteor = true;
        this.showAbilityText('CLICK TO DROP METEOR', 0xaa44dd);
        break;

      case 'coinburst':
        this.addGold(100);
        this.abilityCooldown = spec.abilityCooldown;
        SFX.goldEarned();
        this.showFloatingGold(GAME_WIDTH / 2, GAME_HEIGHT / 2, 100);
        this.showAbilityText('+100 GOLD!', 0x44cc88);
        break;
    }
  }

  /** Drop a meteor at the given location (sorcerer ability) */
  private dropMeteor(x: number, y: number): void {
    const spec = SPECIALISTS[this.myClass];
    this.abilityCooldown = spec.abilityCooldown;
    this.placingMeteor = false;

    SFX.shoot_cannon();

    // Big visual: incoming meteor from above
    const meteor = this.add.image(x, y - 600, 'particle_flare')
      .setScale(2).setTint(0xff6622).setBlendMode(Phaser.BlendModes.ADD).setDepth(100);

    this.tweens.add({
      targets: meteor,
      y: y, scaleX: 4, scaleY: 4,
      duration: 350,
      onComplete: () => {
        meteor.destroy();

        // Massive AoE damage
        const radius = TILE_SIZE * 2.2;
        for (const enemy of this.enemies) {
          if (!enemy.active || enemy.isDead) continue;
          const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
          if (dist <= radius) {
            const falloff = 1 - (dist / radius) * 0.5;
            enemy.takeDamage(300 * falloff, true);
          }
        }

        // Visual explosion
        this.vfx.splashImpact(x, y, radius, 0xff6622);
        this.cameras.main.shake(400, 0.015);
        this.cameras.main.flash(150, 255, 100, 0);
      },
    });
  }

  private showAbilityText(text: string, color: number): void {
    const txt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, text, {
      fontSize: '32px', fontFamily: 'monospace',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: txt, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 1500, onComplete: () => txt.destroy(),
    });
  }

  // ========================
  // SEND MODE
  // ========================

  private sendEnemyToOpponent(enemyType: string): void {
    networkManager.send(NetEventType.SEND_ENEMY, { type: enemyType });

    // Visual feedback
    const txt = this.add.text(GAME_WIDTH / 2, 80, `+ SENT ${enemyType.toUpperCase()} TO OPPONENT!`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#ff6644',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: txt, alpha: 0, y: 50,
      duration: 1500, onComplete: () => txt.destroy(),
    });
  }

  private receiveSentEnemy(enemyType: string): void {
    this.incomingEnemies.push({ type: enemyType, hpScale: 1.5 });

    const txt = this.add.text(GAME_WIDTH / 2, 80, `! INCOMING ${enemyType.toUpperCase()} FROM OPPONENT !`, {
      fontSize: '16px', fontFamily: 'monospace', color: '#ff4444',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: txt, alpha: 0, y: 50,
      duration: 1500, onComplete: () => txt.destroy(),
    });

    // Spawn the enemy immediately as bonus
    this.time.delayedCall(500, () => {
      const sent = this.incomingEnemies.shift();
      if (sent) this.spawnEnemy(sent.type, sent.hpScale, 1);
    });
  }

  // ========================
  // SPLIT LANES
  // ========================

  private giftGold(): void {
    const giftAmount = 50;
    if (this.myGold < giftAmount) {
      SFX.cantPlace();
      return;
    }
    this.spendGold(giftAmount);
    networkManager.send(NetEventType.GIFT_GOLD, { amount: giftAmount });
    SFX.goldEarned();

    const txt = this.add.text(GAME_WIDTH / 2, 80, `Gifted ${giftAmount}g to partner`, {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffd700',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({
      targets: txt, alpha: 0, y: 50,
      duration: 1500, onComplete: () => txt.destroy(),
    });
  }

  private receiveGiftGold(amount: number): void {
    this.addGold(amount);
    SFX.goldEarned();
    this.showFloatingGold(GAME_WIDTH / 2, 100, amount);
  }

  private executeTimeWarp(sendNetwork: boolean): void {
    if (this.timeWarpActive) return;

    this.timeWarpActive = true;
    this.timeWarpDuration = 5000;
    this.timeWarpCooldown = 30000;

    SFX.timeWarp();

    // Subtle overlay (very light)
    this.timeWarpOverlay = this.add.graphics().setDepth(90);
    this.timeWarpOverlay.fillStyle(0x6622cc, 0.05);
    this.timeWarpOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Post-processing: barrel distortion + pixelate + blur
    try {
      const barrel = this.cameras.main.filters.external.addBarrel(1.02);
      const twBlur = this.cameras.main.filters.external.addBlur(1, 0, 0, 0.3);

      // Pulsing barrel distortion
      this.tweens.add({
        targets: barrel, amount: 1.05,
        duration: 1200, yoyo: true, repeat: 3,
      });

      // Remove filters when warp ends
      this.time.delayedCall(5000, () => {
        try {
          this.cameras.main.filters.external.remove(barrel);
          this.cameras.main.filters.external.remove(twBlur);
        } catch (_) { /* already removed */ }
      });
    } catch (_) { /* Canvas fallback */ }

    this.cameras.main.flash(200, 100, 50, 200);

    const twText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 'TIME WARP!', {
      fontSize: '36px', fontFamily: 'monospace', color: '#cc88ff',
      fontStyle: 'bold', stroke: '#220044', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: twText, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 1500, onComplete: () => twText.destroy(),
    });

    if (sendNetwork && this.isMultiplayer) {
      networkManager.send(NetEventType.TIME_WARP);
    }
  }

  // ========================
  // WAVE CONTROL (with network sync)
  // ========================

  private startWave(): void {
    if (this.waveManager.isWaveActive) return;
    this.executeWaveStart(true);
  }

  private executeWaveStart(sendNetwork: boolean): void {
    const started = this.waveManager.startNextWave();
    if (started) {
      SFX.waveStart();
      this.startWaveBtn.setVisible(false);
      this.vfx.waveStart(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);

      const waveAnnounce = this.add.text(
        GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60,
        `Wave ${this.waveManager.currentWave}`,
        {
          fontSize: '32px', fontFamily: 'monospace', color: '#ffaa44',
          fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }
      ).setOrigin(0.5).setDepth(100);

      this.tweens.add({
        targets: waveAnnounce, alpha: 0, y: waveAnnounce.y - 40,
        duration: 1500, delay: 500,
        onComplete: () => waveAnnounce.destroy(),
      });

      if (sendNetwork && this.isMultiplayer) {
        networkManager.send(NetEventType.WAVE_START);
      }
    }
  }

  // ========================
  // SPEED CONTROL (with network sync)
  // ========================

  private setGameSpeed(speed: number): void {
    this.gameSpeed = speed;
    this.updateSpeedUI();
    SFX.uiClick();

    if (this.isMultiplayer) {
      networkManager.send(NetEventType.SPEED_CHANGE, { speed });
    }
  }

  // ========================
  // UI CREATION
  // ========================

  private createHUD(): void {
    const hudBg = this.add.graphics().setDepth(80);
    hudBg.fillStyle(COLORS.uiBg, 0.95);
    hudBg.fillRect(0, 0, GAME_WIDTH, 48);
    hudBg.lineStyle(1, COLORS.uiBorder, 0.5);
    hudBg.lineBetween(0, 48, GAME_WIDTH, 48);

    this.add.text(20, 14, 'GOLD', {
      fontSize: '10px', fontFamily: 'monospace', color: '#887744',
    }).setDepth(81);
    this.goldText = this.add.text(60, 10, `${this.gold}`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold',
    }).setDepth(81);

    this.add.text(180, 14, 'LIVES', {
      fontSize: '10px', fontFamily: 'monospace', color: '#774444',
    }).setDepth(81);
    this.livesText = this.add.text(225, 10, `${this.lives}`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#ff4444', fontStyle: 'bold',
    }).setDepth(81);

    this.add.text(320, 14, 'WAVE', {
      fontSize: '10px', fontFamily: 'monospace', color: '#446688',
    }).setDepth(81);
    this.waveText = this.add.text(360, 10, `0/${this.waveManager.totalWaves}`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#44aaff', fontStyle: 'bold',
    }).setDepth(81);

    this.waveTimerText = this.add.text(500, 14, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#888888',
    }).setDepth(81);
  }

  private createTowerPanel(): void {
    const panelX = GRID_OFFSET_X + GRID_COLS * TILE_SIZE + 12;
    const panelY = 56;

    const panelBg = this.add.graphics().setDepth(80);
    panelBg.fillStyle(COLORS.uiBg, 0.9);
    panelBg.fillRoundedRect(panelX, panelY, 290, GAME_HEIGHT - panelY - 8, 6);
    panelBg.lineStyle(1, COLORS.uiBorder, 0.5);
    panelBg.strokeRoundedRect(panelX, panelY, 290, GAME_HEIGHT - panelY - 8, 6);

    this.add.text(panelX + 145, panelY + 14, 'TOWERS', {
      fontSize: '13px', fontFamily: 'monospace', color: '#8899bb', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(81);

    const btnStartX = panelX + 14;
    const btnStartY = panelY + 34;
    const btnSpacing = 92;

    TOWER_ORDER.forEach((towerId, i) => {
      const def = TOWERS[towerId];
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = btnStartX + col * btnSpacing;
      const by = btnStartY + row * 90;

      const container = this.add.container(bx, by).setDepth(82);

      const bg = this.add.image(27, 27, `tower_btn_${towerId}`);
      const icon = this.add.image(27, 20, `tower_${towerId}`).setScale(0.7);
      const costText = this.add.text(27, 48, `${def.cost}g`, {
        fontSize: '10px', fontFamily: 'monospace', color: '#ffd700',
      }).setOrigin(0.5);
      const hotkey = this.add.text(50, 2, `${i + 1}`, {
        fontSize: '9px', fontFamily: 'monospace', color: '#556677',
      });

      container.add([bg, icon, costText, hotkey]);
      container.setSize(80, 70);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-10, -5, 74, 70),
        Phaser.Geom.Rectangle.Contains
      );

      container.on('pointerup', () => this.selectTowerType(towerId));
      container.on('pointerover', () => {
        if (this.selectedTowerId !== towerId) this.updateInfoForTowerType(towerId);
      });

      this.towerButtons.push(container);
      (container as any)._towerId = towerId;
      (container as any)._bg = bg;
    });
  }

  private createInfoPanel(): void {
    const panelX = GRID_OFFSET_X + GRID_COLS * TILE_SIZE + 12;
    const panelY = 260;

    this.infoPanel = this.add.container(panelX, panelY).setDepth(82);

    const labels = ['name', 'desc', 'damage', 'range', 'rate', 'special', 'upgrade', 'sell', 'kills', 'stats'];
    let y = 0;
    for (const label of labels) {
      const text = this.add.text(10, y, '', {
        fontSize: '11px', fontFamily: 'monospace', color: '#aabbcc',
        wordWrap: { width: 270 },
      });
      this.infoPanel.add(text);
      this.towerInfoTexts[label] = text;
      y += label === 'desc' ? 30 : 18;
    }
  }

  private createActionButtons(): void {
    const panelX = GRID_OFFSET_X + GRID_COLS * TILE_SIZE + 12;
    const btnY = 460;

    // Upgrade button
    this.upgradeBtn = this.add.container(panelX + 10, btnY).setDepth(82).setVisible(false);
    const upgBg = this.add.graphics();
    upgBg.fillStyle(0x224422, 0.9);
    upgBg.fillRoundedRect(0, 0, 130, 32, 4);
    upgBg.lineStyle(1, 0x44aa44, 0.6);
    upgBg.strokeRoundedRect(0, 0, 130, 32, 4);
    const upgText = this.add.text(65, 16, 'UPGRADE [U]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#88ff88', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.upgradeBtn.add([upgBg, upgText]);
    this.upgradeBtn.setSize(130, 32);
    this.upgradeBtn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 130, 32), Phaser.Geom.Rectangle.Contains);
    this.upgradeBtn.on('pointerup', () => {
      if (this.selectedTower) this.upgradeTower(this.selectedTower);
    });
    this.upgradeBtn.on('pointerover', () => upgBg.setAlpha(1.2));
    this.upgradeBtn.on('pointerout', () => upgBg.setAlpha(1));

    // Sell button
    this.sellBtn = this.add.container(panelX + 150, btnY).setDepth(82).setVisible(false);
    const sellBg = this.add.graphics();
    sellBg.fillStyle(0x442222, 0.9);
    sellBg.fillRoundedRect(0, 0, 130, 32, 4);
    sellBg.lineStyle(1, 0xaa4444, 0.6);
    sellBg.strokeRoundedRect(0, 0, 130, 32, 4);
    const sellText = this.add.text(65, 16, 'SELL [S]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ff8888', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.sellBtn.add([sellBg, sellText]);
    this.sellBtn.setSize(130, 32);
    this.sellBtn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 130, 32), Phaser.Geom.Rectangle.Contains);
    this.sellBtn.on('pointerup', () => {
      if (this.selectedTower) this.sellTower(this.selectedTower);
    });
    this.sellBtn.on('pointerover', () => sellBg.setAlpha(1.2));
    this.sellBtn.on('pointerout', () => sellBg.setAlpha(1));
  }

  private createGiftButton(): void {
    if (this.gameMode !== 'splitlanes' || !this.isMultiplayer) return;

    const panelX = GRID_OFFSET_X + GRID_COLS * TILE_SIZE + 12;
    const by = GAME_HEIGHT - 155;

    this.giftBtn = this.add.container(panelX + 10, by).setDepth(82);

    const bg = this.add.graphics();
    bg.fillStyle(0x443322, 0.9);
    bg.fillRoundedRect(0, 0, 130, 32, 4);
    bg.lineStyle(1, 0xddaa44, 0.7);
    bg.strokeRoundedRect(0, 0, 130, 32, 4);

    const label = this.add.text(65, 16, 'GIFT 50G [G]', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.giftBtn.add([bg, label]);
    this.giftBtn.setSize(130, 32);
    this.giftBtn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 130, 32), Phaser.Geom.Rectangle.Contains);
    this.giftBtn.on('pointerup', () => this.giftGold());
  }

  private createTimeWarpButton(): void {
    const panelX = GRID_OFFSET_X + GRID_COLS * TILE_SIZE + 12;
    const by = GAME_HEIGHT - 110;

    this.timeWarpBtn = this.add.container(panelX + 10, by).setDepth(82);

    const spec = SPECIALISTS[this.myClass];
    const bg = this.add.graphics();
    bg.fillStyle(0x222244, 0.9);
    bg.fillRoundedRect(0, 0, 130, 36, 4);
    bg.lineStyle(1, spec.color, 0.7);
    bg.strokeRoundedRect(0, 0, 130, 36, 4);

    const label = this.add.text(65, 10, `${spec.abilityName.toUpperCase()} [Q]`, {
      fontSize: '11px', fontFamily: 'monospace',
      color: Phaser.Display.Color.IntegerToColor(spec.color).rgba,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.timeWarpCooldownText = this.add.text(65, 25, 'Ready', {
      fontSize: '9px', fontFamily: 'monospace', color: '#886699',
    }).setOrigin(0.5);

    this.timeWarpBtn.add([bg, label, this.timeWarpCooldownText]);
    this.timeWarpBtn.setSize(130, 36);
    this.timeWarpBtn.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 130, 36),
      Phaser.Geom.Rectangle.Contains
    );

    this.timeWarpBtn.on('pointerup', () => this.activateAbility());
  }

  private createSpeedControls(): void {
    const panelX = GRID_OFFSET_X + GRID_COLS * TILE_SIZE + 12;
    const by = GAME_HEIGHT - 60;

    this.add.text(panelX + 10, by, 'SPEED', {
      fontSize: '10px', fontFamily: 'monospace', color: '#556677',
    }).setDepth(82);

    this.speedText = this.add.text(panelX + 60, by - 2, `${this.gameSpeed}x`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#88aacc', fontStyle: 'bold',
    }).setDepth(82);

    const speeds = [1, 2, 3];
    speeds.forEach((speed, i) => {
      const btn = this.add.container(panelX + 120 + i * 50, by - 2).setDepth(82);
      const bg = this.add.image(20, 15, `btn_speed_${speed}`);
      const txt = this.add.text(20, 12, `${speed}x`, {
        fontSize: '12px', fontFamily: 'monospace', color: '#aabbcc',
      }).setOrigin(0.5);
      btn.add([bg, txt]);
      btn.setSize(50, 36);
      btn.setInteractive(new Phaser.Geom.Rectangle(-5, -3, 50, 36), Phaser.Geom.Rectangle.Contains);
      btn.on('pointerup', () => this.setGameSpeed(speed));
    });
  }

  private createStartWaveButton(): void {
    const cx = GRID_OFFSET_X + (GRID_COLS * TILE_SIZE) / 2;
    const cy = GAME_HEIGHT - 20;

    this.startWaveBtn = this.add.container(cx, cy).setDepth(85);

    const bg = this.add.graphics();
    bg.fillStyle(0x224422, 0.9);
    bg.fillRoundedRect(-90, -16, 180, 32, 6);
    bg.lineStyle(1.5, 0x44aa44, 0.7);
    bg.strokeRoundedRect(-90, -16, 180, 32, 6);

    const txt = this.add.text(0, -2, 'START WAVE [SPACE]', {
      fontSize: '13px', fontFamily: 'monospace', color: '#88ff88', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.startWaveBtn.add([bg, txt]);
    this.startWaveBtn.setSize(180, 32);
    this.startWaveBtn.setInteractive(
      new Phaser.Geom.Rectangle(-90, -16, 180, 32),
      Phaser.Geom.Rectangle.Contains
    );

    this.startWaveBtn.on('pointerdown', () => this.startWave());
    this.startWaveBtn.on('pointerover', () => {
      this.tweens.add({ targets: this.startWaveBtn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    this.startWaveBtn.on('pointerout', () => {
      this.tweens.add({ targets: this.startWaveBtn, scaleX: 1, scaleY: 1, duration: 100 });
    });

    this.tweens.add({
      targets: this.startWaveBtn, alpha: 0.7,
      duration: 800, yoyo: true, repeat: -1,
    });
  }

  // ========================
  // UI UPDATES
  // ========================

  private updateUI(): void {
    this.goldText.setText(`${this.myGold}`);
    this.livesText.setText(`${this.myLives}`);
    this.waveText.setText(`${this.waveManager.currentWave}/${this.waveManager.totalWaves}`);

    if (this.waveManager.waveBreakTimer > 0) {
      const secs = Math.ceil(this.waveManager.waveBreakTimer / 1000);
      this.waveTimerText.setText(`Next wave in ${secs}s`);
    } else if (this.waveManager.isWaveActive) {
      this.waveTimerText.setText(`Enemies remaining...`);
    } else if (this.waveManager.currentWave === 0) {
      this.waveTimerText.setText('Press SPACE to start');
    } else {
      this.waveTimerText.setText('');
    }

    this.towerButtons.forEach(btn => {
      const towerId = (btn as any)._towerId;
      const cost = this.getTowerCost(towerId);
      const affordable = this.myGold >= cost;
      btn.setAlpha(affordable ? 1 : 0.4);
    });

    // Mode-specific UI updates
    if (this.gameMode === 'send' && this.peerLivesText) {
      this.peerLivesText.setText(`OPP: ${this.peerLives}`);
    }
    if (this.gameMode === 'splitlanes' && this.peerGoldText) {
      const peerGold = networkManager.playerNumber === 2 ? this.goldP1 : this.goldP2;
      const peerLives = networkManager.playerNumber === 2 ? this.livesP1 : this.livesP2;
      this.peerGoldText.setText(`P${networkManager.playerNumber === 2 ? 1 : 2}: ${peerGold}g  ${peerLives}♥`);
    }
  }

  private updateTowerButtons(): void {
    this.towerButtons.forEach(btn => {
      const towerId = (btn as any)._towerId;
      const bg = (btn as any)._bg as Phaser.GameObjects.Image;
      if (this.selectedTowerId === towerId) {
        bg.setTexture(`tower_btn_${towerId}_sel`);
      } else {
        bg.setTexture(`tower_btn_${towerId}`);
      }
    });
  }

  private updateSpeedUI(): void {
    this.speedText.setText(`${this.gameSpeed}x`);
  }

  private updateTimeWarpUI(): void {
    // Legacy time warp — handled by updateAbilityUI now
  }

  private updateAbilityUI(): void {
    if (this.placingMeteor) {
      this.timeWarpCooldownText.setText('SELECT TARGET');
      this.timeWarpBtn.setAlpha(1);
      return;
    }
    if (this.abilityActive) {
      const secs = Math.ceil(this.abilityActiveTimer / 1000);
      this.timeWarpCooldownText.setText(`Active: ${secs}s`);
      this.timeWarpBtn.setAlpha(1);
    } else if (this.abilityCooldown > 0) {
      const secs = Math.ceil(this.abilityCooldown / 1000);
      this.timeWarpCooldownText.setText(`${secs}s`);
      this.timeWarpBtn.setAlpha(0.5);
    } else {
      this.timeWarpCooldownText.setText('Ready');
      this.timeWarpBtn.setAlpha(1);
    }
  }

  private updateInfoForTowerType(towerId: string): void {
    const def = TOWERS[towerId];
    this.towerInfoTexts['name'].setText(def.name).setColor('#ffffff');
    this.towerInfoTexts['desc'].setText(def.description).setColor('#8899aa');
    this.towerInfoTexts['damage'].setText(`Damage: ${def.damage}`).setColor('#ff8866');
    this.towerInfoTexts['range'].setText(`Range: ${def.range} tiles`).setColor('#66aaff');
    this.towerInfoTexts['rate'].setText(`Fire Rate: ${def.fireRate}/s`).setColor('#88cc88');

    let specialText = '';
    if (def.splashRadius) specialText += `Splash: ${def.splashRadius} tiles  `;
    if (def.slowAmount) specialText += `Slow: ${Math.round(def.slowAmount * 100)}%  `;
    if (def.chainCount) specialText += `Chain: ${def.chainCount} targets  `;
    if (def.dotDamage) specialText += `DoT: ${def.dotDamage}/s  `;
    this.towerInfoTexts['special'].setText(specialText).setColor('#ccaa44');

    this.towerInfoTexts['upgrade'].setText(`Cost: ${def.cost}g`).setColor('#ffd700');
    this.towerInfoTexts['sell'].setText('');
    this.towerInfoTexts['kills'].setText('');
    this.towerInfoTexts['stats'].setText('');
  }

  private updateInfoForPlacedTower(tower: Tower): void {
    const def = tower.def;
    const levelStars = '\u2605'.repeat(tower.level + 1) + '\u2606'.repeat(2 - tower.level);
    this.towerInfoTexts['name'].setText(`${def.name} ${levelStars}`).setColor('#ffffff');
    this.towerInfoTexts['desc'].setText(def.description).setColor('#8899aa');
    this.towerInfoTexts['damage'].setText(`Damage: ${Math.round(tower.currentDamage)}`).setColor('#ff8866');
    this.towerInfoTexts['range'].setText(`Range: ${(tower.currentRange / TILE_SIZE).toFixed(1)} tiles`).setColor('#66aaff');
    this.towerInfoTexts['rate'].setText(`Fire Rate: ${tower.currentFireRate.toFixed(1)}/s`).setColor('#88cc88');

    let specialText = '';
    if (def.splashRadius) specialText += `Splash: ${def.splashRadius} tiles  `;
    if (def.slowAmount) specialText += `Slow: ${Math.round(def.slowAmount * 100)}%  `;
    if (def.chainCount) specialText += `Chain: ${def.chainCount + (tower.level > 1 ? 1 : 0)} targets  `;
    if (def.dotDamage) specialText += `DoT: ${Math.round(def.dotDamage * def.damageScale[tower.level])}/s  `;
    this.towerInfoTexts['special'].setText(specialText).setColor('#ccaa44');

    if (tower.upgradeCost !== null) {
      const affordable = this.gold >= tower.upgradeCost;
      this.towerInfoTexts['upgrade'].setText(`Upgrade: ${tower.upgradeCost}g [U]`).setColor(affordable ? '#44ff44' : '#ff4444');
    } else {
      this.towerInfoTexts['upgrade'].setText('MAX LEVEL').setColor('#ffd700');
    }

    this.towerInfoTexts['sell'].setText(`Sell: ${tower.sellValue}g [S]`).setColor('#ff8844');
    this.towerInfoTexts['kills'].setText(`Kills: ${tower.kills}`).setColor('#aabbcc');
    this.towerInfoTexts['stats'].setText(`Total Damage: ${Math.round(tower.totalDamageDealt)}`).setColor('#8899aa');
  }

  private clearInfoPanel(): void {
    for (const key of Object.keys(this.towerInfoTexts)) {
      this.towerInfoTexts[key].setText('');
    }
  }

  private updateWavePreview(): void {
    this.wavePreviewTexts.forEach(t => t.destroy());
    this.wavePreviewTexts = [];

    const preview = this.waveManager.getWavePreview();
    if (preview.length === 0) return;

    const panelX = GRID_OFFSET_X + GRID_COLS * TILE_SIZE + 24;
    const panelY = 500;

    const titleText = this.add.text(panelX, panelY, `Next Wave ${this.waveManager.currentWave + 1}:`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#667799', fontStyle: 'bold',
    }).setDepth(82);
    this.wavePreviewTexts.push(titleText);

    preview.forEach((line, i) => {
      const t = this.add.text(panelX + 8, panelY + 18 + i * 16, line, {
        fontSize: '11px', fontFamily: 'monospace', color: '#556677',
      }).setDepth(82);
      this.wavePreviewTexts.push(t);
    });
  }

  // ========================
  // HELPERS
  // ========================

  private showFloatingGold(x: number, y: number, amount: number): void {
    const text = this.add.text(x, y - 10, `+${amount}`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffd700',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(95);

    this.tweens.add({
      targets: text, y: y - 40, alpha: 0,
      duration: 1000, onComplete: () => text.destroy(),
    });
  }

  // ========================
  // FROG EASTER EGG
  // ========================

  private spawnFrog(): void {
    const gridX = 2 + Math.floor(Math.random() * (GRID_COLS - 4));
    const gridY = 1 + Math.floor(Math.random() * (GRID_ROWS - 2));

    // Only spawn on empty tiles
    if (this.gridManager.grid[gridY][gridX] !== 0) return;

    const fx = GRID_OFFSET_X + gridX * TILE_SIZE + TILE_SIZE / 2;
    const fy = GRID_OFFSET_Y + gridY * TILE_SIZE + TILE_SIZE / 2;

    this.frogSprite = this.add.image(fx, fy, 'frog')
      .setDepth(70)
      .setScale(0)
      .setInteractive({ useHandCursor: true });

    // Pop in
    this.tweens.add({
      targets: this.frogSprite,
      scaleX: 1, scaleY: 1,
      duration: 300, ease: 'Back.easeOut',
    });

    // Subtle idle hop
    this.tweens.add({
      targets: this.frogSprite,
      y: fy - 4,
      duration: 600, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.frogSprite.on('pointerup', () => {
      if (!this.frogSprite) return;
      this.gold += 200;
      SFX.goldEarned();

      // Funny ribbit sound
      try {
        const ctx = new AudioContext();
        const now = ctx.currentTime;
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(200 + i * 100, now + i * 0.1);
          osc.frequency.exponentialRampToValueAtTime(600 + i * 150, now + i * 0.1 + 0.05);
          osc.frequency.exponentialRampToValueAtTime(200 + i * 50, now + i * 0.1 + 0.1);
          gain.gain.setValueAtTime(0.15, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.15);
        }
      } catch (_) {}

      // Show +200 gold
      this.showFloatingGold(this.frogSprite.x, this.frogSprite.y, 200);

      // Big text
      const ribbit = this.add.text(this.frogSprite.x, this.frogSprite.y - 30, 'RIBBIT!', {
        fontSize: '20px', fontFamily: 'monospace', color: '#44ff44',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(100);

      this.tweens.add({
        targets: ribbit, y: ribbit.y - 40, alpha: 0, scaleX: 1.5, scaleY: 1.5,
        duration: 1000, onComplete: () => ribbit.destroy(),
      });

      // Pop out
      this.tweens.add({
        targets: this.frogSprite,
        scaleX: 0, scaleY: 0, alpha: 0,
        duration: 200,
        onComplete: () => {
          this.frogSprite?.destroy();
          this.frogSprite = null;
        },
      });
    });

    // Auto-despawn after 5 seconds
    this.time.delayedCall(5000, () => {
      if (this.frogSprite) {
        this.tweens.add({
          targets: this.frogSprite,
          scaleX: 0, scaleY: 0, alpha: 0,
          duration: 300,
          onComplete: () => {
            this.frogSprite?.destroy();
            this.frogSprite = null;
          },
        });
      }
    });
  }
}
