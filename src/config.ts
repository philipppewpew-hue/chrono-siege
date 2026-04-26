// ============================================================
// CHRONO SIEGE - Game Configuration
// ============================================================

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Grid
export const TILE_SIZE = 48;
export const GRID_COLS = 20;
export const GRID_ROWS = 12;
export const GRID_OFFSET_X = 16;
export const GRID_OFFSET_Y = 56;

// UI
export const UI_PANEL_X = GRID_OFFSET_X + GRID_COLS * TILE_SIZE + 16;
export const UI_PANEL_WIDTH = GAME_WIDTH - UI_PANEL_X;
export const HUD_HEIGHT = 48;

// Gameplay
export const STARTING_GOLD = 200;
export const STARTING_LIVES = 20;
export const TOTAL_WAVES = 25;
export const WAVE_BREAK_TIME = 8000; // ms between waves

// ============================================================
// MULTIPLAYER MODES
// ============================================================
export type GameMode = 'solo' | 'coop' | 'send' | 'splitlanes';

export interface GameModeDef {
  id: GameMode;
  name: string;
  description: string;
}

export const GAME_MODES: Record<GameMode, GameModeDef> = {
  solo: {
    id: 'solo',
    name: 'Solo',
    description: 'Play alone',
  },
  coop: {
    id: 'coop',
    name: 'Co-op',
    description: 'Shared gold and lives. Build together.',
  },
  send: {
    id: 'send',
    name: 'Send Mode',
    description: 'Compete on separate maps. Kill streaks send extra enemies to opponent.',
  },
  splitlanes: {
    id: 'splitlanes',
    name: 'Split Lanes',
    description: 'Each player defends their lane. Separate gold. Gift to help.',
  },
};

// ============================================================
// SPECIALIST CLASSES
// ============================================================
export type SpecialistClass = 'architect' | 'commander' | 'sorcerer' | 'scout';

export interface SpecialistDef {
  id: SpecialistClass;
  name: string;
  description: string;
  color: number;
  // Passive modifiers
  towerCostMultiplier: number;
  damageMultiplier: number;
  goldMultiplier: number;
  // Ability (replaces Time Warp)
  abilityName: string;
  abilityKey: string;
  abilityDescription: string;
  abilityCooldown: number; // ms
}

export const SPECIALISTS: Record<SpecialistClass, SpecialistDef> = {
  architect: {
    id: 'architect',
    name: 'Architect',
    description: 'Master builder — towers cost 20% less',
    color: 0x88aacc,
    towerCostMultiplier: 0.8,
    damageMultiplier: 1.0,
    goldMultiplier: 1.0,
    abilityName: 'Reinforce',
    abilityKey: 'reinforce',
    abilityDescription: 'All towers gain +25 max range for 8s',
    abilityCooldown: 25000,
  },
  commander: {
    id: 'commander',
    name: 'Commander',
    description: 'Battle leader — towers deal 20% more damage',
    color: 0xcc6644,
    towerCostMultiplier: 1.0,
    damageMultiplier: 1.2,
    goldMultiplier: 1.0,
    abilityName: 'Rally',
    abilityKey: 'rally',
    abilityDescription: 'All towers fire 2x speed for 6s',
    abilityCooldown: 30000,
  },
  sorcerer: {
    id: 'sorcerer',
    name: 'Sorcerer',
    description: 'Master of arcane forces',
    color: 0xaa44dd,
    towerCostMultiplier: 1.0,
    damageMultiplier: 1.0,
    goldMultiplier: 1.0,
    abilityName: 'Meteor',
    abilityKey: 'meteor',
    abilityDescription: 'Click anywhere to drop a meteor (300 dmg AoE)',
    abilityCooldown: 25000,
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    description: 'Treasure hunter — earn 50% more gold',
    color: 0x44cc88,
    towerCostMultiplier: 1.0,
    damageMultiplier: 1.0,
    goldMultiplier: 1.5,
    abilityName: 'Coin Burst',
    abilityKey: 'coinburst',
    abilityDescription: 'Instantly earn 100 gold',
    abilityCooldown: 30000,
  },
};

export const SPECIALIST_ORDER: SpecialistClass[] = ['architect', 'commander', 'sorcerer', 'scout'];

// Colors
export const COLORS = {
  bg: 0x0a0a1a,
  gridLight: 0x1a2a1a,
  gridDark: 0x0f1f0f,
  gridLine: 0x2a3a2a,
  path: 0x2a1a0a,
  spawn: 0x4a1a1a,
  base: 0x1a1a4a,
  uiBg: 0x111122,
  uiBorder: 0x334466,
  uiText: 0xccddff,
  uiGold: 0xffd700,
  uiLives: 0xff4444,
  uiWave: 0x44aaff,
  hpBarBg: 0x220000,
  hpBar: 0x00ff44,
  hpBarLow: 0xff4400,
  towerRange: 0xffffff,
  blocked: 0xff0000,
  valid: 0x00ff00,
};

// Tower definitions
export interface TowerDef {
  id: string;
  name: string;
  cost: number;
  damage: number;
  range: number;       // in tiles
  fireRate: number;    // shots per second
  projectileSpeed: number;
  color: number;
  glowColor: number;
  description: string;
  splashRadius?: number;
  slowAmount?: number;
  slowDuration?: number;
  chainCount?: number;
  dotDamage?: number;
  dotDuration?: number;
  upgradeCosts: number[];   // cost for level 2, 3
  damageScale: number[];    // multiplier at each upgrade
  rangeScale: number[];
  rateScale: number[];
}

export const TOWERS: Record<string, TowerDef> = {
  arrow: {
    id: 'arrow',
    name: 'Arrow Tower',
    cost: 50,
    damage: 12,
    range: 3.5,
    fireRate: 2.0,
    projectileSpeed: 500,
    color: 0x88cc44,
    glowColor: 0xbbff66,
    description: 'Fast single-target damage',
    upgradeCosts: [60, 120],
    damageScale: [1, 1.8, 3.0],
    rangeScale: [1, 1.15, 1.3],
    rateScale: [1, 1.2, 1.5],
  },
  cannon: {
    id: 'cannon',
    name: 'Cannon Tower',
    cost: 100,
    damage: 35,
    range: 2.5,
    fireRate: 0.7,
    projectileSpeed: 300,
    color: 0xcc6622,
    glowColor: 0xff8844,
    description: 'Splash damage in an area',
    splashRadius: 1.2,
    upgradeCosts: [100, 200],
    damageScale: [1, 1.6, 2.8],
    rangeScale: [1, 1.1, 1.25],
    rateScale: [1, 1.15, 1.3],
  },
  frost: {
    id: 'frost',
    name: 'Frost Tower',
    cost: 75,
    damage: 8,
    range: 3.0,
    fireRate: 1.5,
    projectileSpeed: 400,
    color: 0x44aaee,
    glowColor: 0x88ddff,
    description: 'Slows enemies on hit',
    slowAmount: 0.4,
    slowDuration: 2000,
    upgradeCosts: [80, 160],
    damageScale: [1, 1.5, 2.2],
    rangeScale: [1, 1.2, 1.4],
    rateScale: [1, 1.2, 1.4],
  },
  lightning: {
    id: 'lightning',
    name: 'Lightning Tower',
    cost: 125,
    damage: 18,
    range: 3.0,
    fireRate: 1.0,
    projectileSpeed: 800,
    color: 0xdddd44,
    glowColor: 0xffff88,
    description: 'Chains to nearby enemies',
    chainCount: 3,
    upgradeCosts: [120, 240],
    damageScale: [1, 1.7, 2.8],
    rangeScale: [1, 1.15, 1.3],
    rateScale: [1, 1.2, 1.4],
  },
  poison: {
    id: 'poison',
    name: 'Poison Tower',
    cost: 100,
    damage: 6,
    range: 2.5,
    fireRate: 1.2,
    projectileSpeed: 350,
    color: 0x66cc66,
    glowColor: 0x88ff88,
    description: 'Deals damage over time',
    dotDamage: 5,
    dotDuration: 3000,
    splashRadius: 0.8,
    upgradeCosts: [100, 200],
    damageScale: [1, 1.6, 2.5],
    rangeScale: [1, 1.15, 1.3],
    rateScale: [1, 1.2, 1.4],
  },
  chrono: {
    id: 'chrono',
    name: 'Chrono Tower',
    cost: 150,
    damage: 15,
    range: 2.5,
    fireRate: 0.8,
    projectileSpeed: 250,
    color: 0xaa44dd,
    glowColor: 0xcc88ff,
    description: 'Time distortion - massive slow',
    slowAmount: 0.6,
    slowDuration: 3000,
    upgradeCosts: [150, 300],
    damageScale: [1, 1.5, 2.5],
    rangeScale: [1, 1.2, 1.5],
    rateScale: [1, 1.15, 1.3],
  },
};

export const TOWER_ORDER = ['arrow', 'cannon', 'frost', 'lightning', 'poison', 'chrono'];

// Enemy definitions
export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;       // pixels per second
  reward: number;
  color: number;
  size: number;         // radius multiplier
  liveCost: number;     // lives lost if reaches base
  armor: number;        // flat damage reduction
  description: string;
  special?: string;
}

export const ENEMIES: Record<string, EnemyDef> = {
  scout: {
    id: 'scout',
    name: 'Scout',
    hp: 70,
    speed: 120,
    reward: 5,
    color: 0x44cc44,
    size: 0.6,
    liveCost: 1,
    armor: 0,
    description: 'Fast and fragile',
  },
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    hp: 150,
    speed: 80,
    reward: 8,
    color: 0xccaa44,
    size: 0.8,
    liveCost: 1,
    armor: 3,
    description: 'Balanced stats',
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    hp: 380,
    speed: 50,
    reward: 15,
    color: 0x8888cc,
    size: 1.0,
    liveCost: 2,
    armor: 12,
    description: 'Heavy armor',
    special: 'armored',
  },
  assassin: {
    id: 'assassin',
    name: 'Assassin',
    hp: 100,
    speed: 150,
    reward: 12,
    color: 0xcc44cc,
    size: 0.65,
    liveCost: 1,
    armor: 0,
    description: 'Very fast, can dodge',
    special: 'dodge',
  },
  healer: {
    id: 'healer',
    name: 'Healer',
    hp: 180,
    speed: 65,
    reward: 20,
    color: 0x44ffaa,
    size: 0.75,
    liveCost: 1,
    armor: 0,
    description: 'Heals nearby enemies',
    special: 'healer',
  },
  splitter: {
    id: 'splitter',
    name: 'Splitter',
    hp: 200,
    speed: 70,
    reward: 10,
    color: 0xff8844,
    size: 0.9,
    liveCost: 1,
    armor: 0,
    description: 'Splits into two on death',
    special: 'split',
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom',
    hp: 150,
    speed: 90,
    reward: 15,
    color: 0x8844aa,
    size: 0.7,
    liveCost: 2,
    armor: 0,
    description: 'Phases in and out',
    special: 'phase',
  },
  titan: {
    id: 'titan',
    name: 'Titan',
    hp: 2500,
    speed: 35,
    reward: 100,
    color: 0xff2222,
    size: 1.4,
    liveCost: 10,
    armor: 15,
    description: 'BOSS - Massive HP',
    special: 'boss',
  },
};

// Wave definitions
export interface WaveEntry {
  enemyType: string;
  count: number;
  delay: number;      // ms between spawns
  hpScale?: number;
  speedScale?: number;
}

export interface WaveDef {
  entries: WaveEntry[];
  bonusGold: number;
}

export function generateWaves(): WaveDef[] {
  const waves: WaveDef[] = [];

  // Wave 1-5: Introduction
  waves.push({
    entries: [{ enemyType: 'scout', count: 8, delay: 800 }],
    bonusGold: 20,
  });
  waves.push({
    entries: [{ enemyType: 'scout', count: 10, delay: 700 }],
    bonusGold: 20,
  });
  waves.push({
    entries: [
      { enemyType: 'scout', count: 5, delay: 800 },
      { enemyType: 'soldier', count: 5, delay: 1000 },
    ],
    bonusGold: 25,
  });
  waves.push({
    entries: [{ enemyType: 'soldier', count: 10, delay: 800 }],
    bonusGold: 30,
  });
  waves.push({
    entries: [
      { enemyType: 'soldier', count: 8, delay: 600 },
      { enemyType: 'titan', count: 1, delay: 0, hpScale: 0.5 },
    ],
    bonusGold: 50,
  });

  // Wave 6-10: Mix it up
  waves.push({
    entries: [
      { enemyType: 'scout', count: 12, delay: 500 },
      { enemyType: 'assassin', count: 4, delay: 1200 },
    ],
    bonusGold: 30,
  });
  waves.push({
    entries: [
      { enemyType: 'knight', count: 5, delay: 1500 },
      { enemyType: 'soldier', count: 8, delay: 800 },
    ],
    bonusGold: 35,
  });
  waves.push({
    entries: [
      { enemyType: 'splitter', count: 8, delay: 1000 },
    ],
    bonusGold: 35,
  });
  waves.push({
    entries: [
      { enemyType: 'healer', count: 3, delay: 2000 },
      { enemyType: 'soldier', count: 12, delay: 600 },
    ],
    bonusGold: 40,
  });
  waves.push({
    entries: [
      { enemyType: 'knight', count: 6, delay: 1000 },
      { enemyType: 'titan', count: 1, delay: 0, hpScale: 0.8 },
    ],
    bonusGold: 60,
  });

  // Wave 11-15: Getting tough
  waves.push({
    entries: [
      { enemyType: 'phantom', count: 8, delay: 800 },
      { enemyType: 'assassin', count: 6, delay: 600 },
    ],
    bonusGold: 40,
  });
  waves.push({
    entries: [
      { enemyType: 'splitter', count: 10, delay: 800 },
      { enemyType: 'healer', count: 4, delay: 1500 },
    ],
    bonusGold: 45,
  });
  waves.push({
    entries: [
      { enemyType: 'knight', count: 10, delay: 800, hpScale: 1.3 },
      { enemyType: 'soldier', count: 15, delay: 400 },
    ],
    bonusGold: 50,
  });
  waves.push({
    entries: [
      { enemyType: 'phantom', count: 6, delay: 800 },
      { enemyType: 'healer', count: 5, delay: 1200 },
      { enemyType: 'knight', count: 5, delay: 1200 },
    ],
    bonusGold: 55,
  });
  waves.push({
    entries: [
      { enemyType: 'titan', count: 2, delay: 3000 },
      { enemyType: 'knight', count: 8, delay: 800 },
    ],
    bonusGold: 80,
  });

  // Wave 16-20: Intense
  waves.push({
    entries: [
      { enemyType: 'assassin', count: 15, delay: 400, hpScale: 1.5 },
    ],
    bonusGold: 50,
  });
  waves.push({
    entries: [
      { enemyType: 'splitter', count: 12, delay: 600, hpScale: 1.5 },
      { enemyType: 'healer', count: 6, delay: 1000 },
    ],
    bonusGold: 60,
  });
  waves.push({
    entries: [
      { enemyType: 'knight', count: 12, delay: 700, hpScale: 1.8 },
      { enemyType: 'phantom', count: 8, delay: 700 },
    ],
    bonusGold: 65,
  });
  waves.push({
    entries: [
      { enemyType: 'scout', count: 30, delay: 200, hpScale: 2.0 },
      { enemyType: 'assassin', count: 10, delay: 400, hpScale: 1.5 },
    ],
    bonusGold: 70,
  });
  waves.push({
    entries: [
      { enemyType: 'titan', count: 3, delay: 2000, hpScale: 1.2 },
      { enemyType: 'healer', count: 8, delay: 800 },
    ],
    bonusGold: 100,
  });

  // Wave 21-25: Final stand
  waves.push({
    entries: [
      { enemyType: 'phantom', count: 15, delay: 500, hpScale: 2.0 },
      { enemyType: 'assassin', count: 10, delay: 400, hpScale: 2.0 },
    ],
    bonusGold: 70,
  });
  waves.push({
    entries: [
      { enemyType: 'splitter', count: 15, delay: 500, hpScale: 2.5 },
      { enemyType: 'knight', count: 10, delay: 700, hpScale: 2.5 },
    ],
    bonusGold: 80,
  });
  waves.push({
    entries: [
      { enemyType: 'healer', count: 10, delay: 600, hpScale: 2.0 },
      { enemyType: 'knight', count: 15, delay: 500, hpScale: 3.0 },
      { enemyType: 'phantom', count: 10, delay: 500, hpScale: 2.0 },
    ],
    bonusGold: 90,
  });
  waves.push({
    entries: [
      { enemyType: 'titan', count: 4, delay: 2000, hpScale: 2.0 },
      { enemyType: 'splitter', count: 20, delay: 400, hpScale: 2.0 },
    ],
    bonusGold: 100,
  });
  waves.push({
    entries: [
      { enemyType: 'titan', count: 5, delay: 1500, hpScale: 3.0 },
      { enemyType: 'healer', count: 10, delay: 500, hpScale: 3.0 },
      { enemyType: 'knight', count: 20, delay: 300, hpScale: 3.0 },
      { enemyType: 'assassin', count: 15, delay: 300, hpScale: 3.0 },
    ],
    bonusGold: 200,
  });

  return waves;
}
